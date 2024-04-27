import { useRef, type JSX } from 'react'
import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import {
    useContext, useState, type ChangeEvent, type CSSProperties
} from 'react'
import * as schema from '../api_schema'
import { UpdateErrorContext, type UpdateError } from '../components/error'
import useAsyncEffect from 'use-async-effect'
import moment, { type Moment } from 'moment'
import type { z } from 'zod'
import { ShowModalContext, type ShowModal } from '../components/modal'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Page pageName='bank'>
        <Bank />
    </Page>
)

type BankAccount = {
    balance: number,
    allowance: number,
    hist: { balance: number, date: Moment }[],
}

function Bank() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)

    const [reload, setReload] = useState(false)
    const runReload = () => setReload(reload => !reload)
    const [account, setAccount] = useState<BankAccount>()
    const [page, setPage] = useState(0)
    const [maybeMore, setMaybeMore] = useState(true)

    useAsyncEffect(async isMounted => {
        setPage(0)
        const options = { params: { uuid, page: 0 }, schema: schema.bankAccountResponse, updateError }
        const response = await schema.apiFetch('bankaccount', options)
        if (response && isMounted()) {
            const { balance, allowance, hist } = response
            setAccount({
                balance,
                allowance,
                hist: hist.map(({ balance, isoTimestamp }) => ({ balance, date: moment(isoTimestamp) })),
            })
            setMaybeMore(hist.length === schema.BANK_HISTORY_LENGTH)
            setPage(hist.length === schema.BANK_HISTORY_LENGTH ? 1 : 0)
        }
    }, [reload])

    const onLoadMore = async () => {
        const options = { params: { uuid, page }, schema: schema.bankAccountResponse, updateError }
        const response = await schema.apiFetch('bankaccount', options)
        if (response) {
            const newHist = response.hist.map(({ balance, isoTimestamp }) => ({ balance, date: moment(isoTimestamp) }))
            setAccount(account => account && ({
                ...account,
                hist: account.hist.concat(newHist),
            }))
            if (response.hist.length < schema.BANK_HISTORY_LENGTH) {
                setMaybeMore(false)
            } else {
                setPage(page + 1)
            }

        }
    }

    const loadMore = (
        maybeMore ?
            <div className='bank-entry load-more-entry'>
                <button className='load-more-button' onClick={onLoadMore}>Load more...</button>
            </div>
            :
            undefined
    )

    return (
        <div className='bank'>
            <Input
                uuid={uuid}
                updateError={updateError}
                account={account}
                runReload={runReload}
            />
            <History account={account} loadMore={loadMore} />
        </div>
    )
}

type InputType = 'unit' | 'tenth' | 'hundredth' | 'disabled'

type InputProps = {
    uuid: schema.Uuid,
    updateError: UpdateError,
    account: BankAccount | undefined,
    runReload: () => void,
}
function Input({ uuid, updateError, account, runReload }: InputProps) {
    const showModal = useContext(ShowModalContext)

    const [amount, setAmount] = useState(0)
    const [inputType, setInputType] = useState<InputType>('unit')
    const [adding, setAdding] = useState(false);

    const onKeyClick = (label: string | number) => {
        return async () => {
            if (typeof label === 'number') {
                switch (inputType) {
                    case 'unit':
                        if (amount < 10_000) {
                            setAmount(amount * 10 + label)
                        }
                        break
                    case 'tenth':
                        setAmount(amount + label / 10)
                        setInputType('hundredth')
                        break
                    case 'hundredth':
                        setAmount(amount + label / 100)
                        setInputType('disabled')
                        break
                }

            } else if (label === '←') {
                switch (inputType) {
                    case 'unit':
                        setAmount(Math.floor(amount / 10))
                        break
                    case 'hundredth':
                        setAmount(Math.floor(amount))
                        setInputType('tenth')
                        break
                    case 'tenth':
                        setInputType('unit')
                        break
                    case 'disabled':
                        setAmount(Math.floor(amount * 10) / 10)
                        setInputType('hundredth')
                        break
                }

            } else if (label === '.' && inputType === 'unit') {
                setInputType('tenth')
            } else if (label === '+') {
                setAdding(true)
            } else if (label === '-') {
                setAdding(false)
            } else if (label === '$') {
                showModal(
                    <Settings
                        uuid={uuid}
                        updateError={updateError}
                        runReload={runReload}
                        showModal={showModal}
                        allowance={account?.allowance ?? 0}
                    />
                )
            } else if (label === '↲' && amount !== 0) {
                setAmount(0)
                setInputType('unit')
                setAdding(false)

                const body: z.infer<typeof schema.bankTransactBody> = { uuid, amount, adding }
                const options = { body, schema: schema.bankTransactResponse, updateError }
                const response = await schema.apiFetch('banktransact', options)
                if (response) {
                    runReload()
                }
            }
        }
    }

    const newKey = (label: string | number, style: CSSProperties) => (
        <div key={label} style={style} className='numkey button' onClick={onKeyClick(label)} >
            {label}
        </div>
    )

    const keys = []
    keys.push(newKey('$', { gridColumn: '1 / 3' }))
    keys.push(newKey('←', { gridColumn: '3 / 5' }))
    for (let i = 1; i < 10; i++) {
        keys.push(newKey(i, {
            gridRow: 4 - Math.floor((i - 1) / 3),
            gridColumn: ((i - 1) % 3) + 1,
        }))
    }
    keys.push(newKey(0, { gridColumn: '1 / 3' }))
    keys.push(newKey('.', { gridColumn: 3 }))
    keys.push(newKey(adding ? '-' : '+', { gridRow: '2 / 4' }))
    keys.push(newKey('↲', { gridRow: '4 / 6' }))

    const displayAmount = (
        (inputType === 'hundredth') ?
            amount.toFixed(1) :
            (inputType === 'disabled') ?
                amount.toFixed(2) :
                (Math.floor(amount) === amount) ?     // if amount is an int, only show '.' if it was pressed
                    `${amount}${inputType === 'unit' ? '' : '.'}` :
                    amount
    )

    return (
        <div className='bank-panel input'>
            <div className='display'>{adding ? '+' : ''}${displayAmount}</div>
            <div className='numpad'>
                {keys}
            </div>
        </div>
    )
}

function History({ account, loadMore }: { account: BankAccount | undefined, loadMore: JSX.Element | undefined }) {
    const displayBalance = (balance: number) =>
        `${Math.ceil(balance * 100) < 0 ? '-' : ''}$${Math.abs(balance).toFixed(2)}`
    const displayDate = (date: Moment) =>
        `${date.format('dddd, MMMM Do. h:mm A')} (${date.fromNow()})`

    const currentEntry = (
        <div className='bank-entry bank-entry-current'>
            <div className='bank-entry-balance'>{displayBalance(account ? account.balance : 0)}</div>
        </div>
    )

    const history = account ? account.hist : []
    const olderEntries = history.map(({ balance, date }, i) => (
        <div key={i} className='bank-entry bank-entry-older'>
            <div className='bank-entry-balance'>{displayBalance(balance)}</div>
            <div className='bank-entry-date'>{displayDate(date)}</div>
        </div>
    ))

    const showOlder: CSSProperties = {
        visibility: history.length > 1 ? 'visible' : 'hidden'
    }
    return (
        <div className='history'>
            <div className='bank-panel-label'>Current Balance</div>
            <div className='bank-panel history-current'>{currentEntry}</div>
            <div className='bank-panel-label' style={showOlder}>Prior Balances</div>
            <div className='bank-panel history-older' style={showOlder}>{olderEntries}{loadMore}</div>
        </div>
    )
}

type SettingsProps = {
    uuid: schema.Uuid,
    updateError: UpdateError,
    showModal: ShowModal,
    runReload: () => void,
    allowance: number,
}
function Settings({ uuid, updateError, showModal, runReload, allowance }: SettingsProps) {
    const [newAllowance, setNewAllowance] = useState<number>(allowance)
    const bankSettings = useRef<HTMLDivElement | null>(null)

    const onNewAllowanceChange = (event: ChangeEvent<HTMLInputElement>) => {
        const newAllowance = Number(event.target.value.replace('$', ''))
        if (!isNaN(newAllowance) && newAllowance >= 0) {
            setNewAllowance(newAllowance)
        }
    }

    const onUpdate = async () => {
        const body: z.infer<typeof schema.setAllowanceBody> = { uuid, allowance: newAllowance }
        await schema.apiFetch('setallowance', { body, updateError })
        runReload()
        showModal(null)
    }

    return (
        <div className='bank-settings' ref={bankSettings}>
            <div>
                <label htmlFor='allowance'>Allowance</label>
                <input
                    value={newAllowance ? `$${newAllowance}` : ''}
                    id='allowance'
                    onChange={onNewAllowanceChange}
                />
            </div>
            <button className='button update-button' onClick={onUpdate}>Update</button>
        </div>
    )
}