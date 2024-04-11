import { type JSX } from 'react'
import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import {
    useContext, useState, type ChangeEvent, type CSSProperties, type Dispatch,
    type MouseEvent, type SetStateAction
} from 'react'
import {
    apiErrorSchema,
    BANK_ACCOUNT_ENDPOINT, BANK_HISTORY_LENGTH, BANK_HISTORY_PAGE_PARAM, BANK_TRANSACT_ENDPOINT,
    bankAccountResponseSchema,
    bankTransactBodySchema,
    bankTransactResponseSchema,
    SET_ALLOWANCE_ENDPOINT,
    setAllowanceBodySchema,
    UUID_PARAM,
    type Uuid
} from '../api_schema'
import { UpdateErrorContext, type UpdateError } from '../components/error'
import useAsyncEffect from 'use-async-effect'
import moment, { type Moment } from 'moment'
import type { z } from 'zod'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
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
    const [showSettings, setShowSettings] = useState(false)
    const [account, setAccount] = useState<BankAccount>()
    const [page, setPage] = useState(0)
    const [maybeMore, setMaybeMore] = useState(true)

    useAsyncEffect(async isMounted => {
        setPage(0)
        const searchParams = new URLSearchParams({ [UUID_PARAM]: uuid, [BANK_HISTORY_PAGE_PARAM]: '0' })
        try {
            const response = await fetch(`/api/${BANK_ACCOUNT_ENDPOINT}?${searchParams}`)
            const body = await response.json()
            if (isMounted()) {
                if (response.status === 200) {
                    const { balance, allowance, hist } = bankAccountResponseSchema.parse(body)
                    setAccount({
                        balance,
                        allowance,
                        hist: hist.map(({ balance, isoTimestamp }) => ({ balance, date: moment(isoTimestamp) })),
                    })
                    setMaybeMore(hist.length === BANK_HISTORY_LENGTH)
                } else {
                    updateError(apiErrorSchema.parse(body).error)
                }
            }
        } catch {
            updateError()
        }
    }, [reload])

    const onLoadMore = async () => {
        const searchParams = new URLSearchParams({ [UUID_PARAM]: uuid, [BANK_HISTORY_PAGE_PARAM]: page.toString() })
        try {
            const response = await fetch(`/api/${BANK_ACCOUNT_ENDPOINT}?${searchParams}`)
            const body = await response.json()
            if (response.status === 200) {
                const { hist } = bankAccountResponseSchema.parse(body)
                const newHist = hist.map(({ balance, isoTimestamp }) => ({ balance, date: moment(isoTimestamp) }))
                setAccount(account => account && ({
                    ...account,
                    hist: account.hist.concat(newHist),
                }))
                if (hist.length < BANK_HISTORY_LENGTH) {
                    setMaybeMore(false)
                } else {
                    setPage(page + 1)
                }
            } else {
                updateError(apiErrorSchema.parse(body).error)
            }
        } catch {
            updateError()
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
            {
                showSettings &&
                <Settings
                    uuid={uuid}
                    updateError={updateError}
                    allowance={account ? account.allowance : 0}
                    runReload={runReload}
                    setShowSettings={setShowSettings}
                />
            }
            <Input
                uuid={uuid}
                updateError={updateError}
                runReload={runReload}
                setShowSettings={setShowSettings}
            />
            <History account={account} loadMore={loadMore} />
        </div>
    )
}

type InputType = 'unit' | 'tenth' | 'hundredth' | 'disabled'

type InputProps = {
    uuid: Uuid,
    updateError: UpdateError,
    runReload: () => void,
    setShowSettings: Dispatch<SetStateAction<boolean>>,
}
function Input({ uuid, updateError, runReload, setShowSettings }: InputProps) {
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
                setShowSettings(true)
            } else if (label === '↲' && amount !== 0) {
                setAmount(0)
                setInputType('unit')
                setAdding(false)

                const body: z.infer<typeof bankTransactBodySchema> = { uuid, amount }
                if (adding) {
                    body.adding = true
                }
                const init = {
                    method: 'POST',
                    body: JSON.stringify(body),
                }
                try {
                    const response = await fetch(`/api/${BANK_TRANSACT_ENDPOINT}`, init)
                    const body = await response.json()
                    if (response.status === 200) {
                        const { newBalance } = bankTransactResponseSchema.parse(body)
                        runReload()
                    } else {
                        updateError(apiErrorSchema.parse(body).error)
                    }
                } catch {
                    updateError()
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
    uuid: Uuid,
    updateError: UpdateError,
    allowance: number,
    runReload: () => void,
    setShowSettings: Dispatch<SetStateAction<boolean>>,
}
function Settings({ uuid, updateError, allowance, runReload, setShowSettings }: SettingsProps) {
    const [newAllowance, setNewAllowance] = useState<number>(allowance)

    const onOutsideClick = (event: MouseEvent) => {
        if (event.target instanceof Element && !document.querySelector('.bank-settings')?.contains(event.target)) {
            setShowSettings(false)
        }
    }

    const onNewAllowanceChange = (event: ChangeEvent<HTMLInputElement>) => {
        const newAllowance = Number(event.target.value.replace('$', ''))
        if (!isNaN(newAllowance) && newAllowance >= 0) {
            setNewAllowance(newAllowance)
        }
    }

    const onUpdate = async () => {
        try {
            const body: z.infer<typeof setAllowanceBodySchema> = { uuid, allowance: newAllowance }
            const init: FetchRequestInit = { method: 'POST', body: JSON.stringify(body) }
            const response = await fetch(`/api/${SET_ALLOWANCE_ENDPOINT}`, init)
            if (response.status !== 200) {
                updateError(apiErrorSchema.parse(await response.json()).error)
            }
        } catch {
            updateError()
        }
        runReload()
        setShowSettings(false)
    }

    return (
        <div className='bank-settings-container' onClick={onOutsideClick}>
            <div className='bank-settings bank-panel'>
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
        </div>
    )
}