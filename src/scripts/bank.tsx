import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import { useContext, useState, type CSSProperties } from 'react'
import {
    BANK_HISTORY_ENDPOINT, BANK_TRANSACT_ENDPOINT,
    isApiError, isBankHistoryResponse, isBankTransactResponse, UUID_PARAM, type BankTransactBody,
    type Uuid
} from '../sharedtypes'
import { UpdateErrorContext, type UpdateError } from '../components/error'
import useAsyncEffect from 'use-async-effect'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='bank'>
        <Bank />
    </Page>
)

function Bank() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)

    return (
        <div className='bank'>
            <Input uuid={uuid} updateError={updateError} />
            <History uuid={uuid} updateError={updateError} />
        </div >
    )
}

type InputType = 'unit' | 'tenth' | 'hundredth' | 'disabled'

function Input({ uuid, updateError }: { uuid: Uuid, updateError: UpdateError }) {
    const [amount, setAmount] = useState(0)
    const [inputType, setInputType] = useState<InputType>('unit')
    const [adding, setAdding] = useState(false);

    const onKeyClick = (label: string | number) => {
        return async () => {
            if (typeof label === 'number') {
                switch (inputType) {
                    case 'unit':
                        setAmount(amount * 10 + label)
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
            } else if (label === '↲') {
                setAmount(0)
                setInputType('unit')
                setAdding(false)

                const body: BankTransactBody = { uuid, amount }
                if (adding) {
                    body.adding = true
                }
                const init = {
                    method: 'POST',
                    body: JSON.stringify(body)
                }
                const response = await fetch(`/api/${BANK_TRANSACT_ENDPOINT}`, init)
                try {
                    const body = await response.json()
                    if (response.status === 200) {
                        if (isBankTransactResponse(body)) {
                            console.log(body.newBalance)
                        } else {
                            updateError()
                        }
                    } else {
                        if (isApiError(body)) {
                            updateError(body.error)
                        } else {
                            updateError()
                        }
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
    keys.push(newKey('', { gridColumn: '1 / 3' }))
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

type BankEntry = { balance: number, date: Date }

function History({ uuid, updateError }: { uuid: Uuid, updateError: UpdateError }) {
    const [history, setHistory] = useState<BankEntry[]>([])

    useAsyncEffect(async isMounted => {
        const response = await fetch(`/api/${BANK_HISTORY_ENDPOINT}?${UUID_PARAM}=${uuid}`)
        const body = await response.json()
        if (isMounted()) {
            if (response.status === 200) {
                if (isBankHistoryResponse(body)) {
                    setHistory(body.hist.map(({ balance, isoTimestamp }) => ({ balance, date: new Date(isoTimestamp) })))
                } else {
                    updateError()
                }
            } else {
                if (isApiError(body)) {
                    updateError(body.error)
                } else {
                    updateError()
                }
            }
        }
    })

    return (
        <div className='bank-panel history'>{JSON.stringify(history)}</div>
    )
}