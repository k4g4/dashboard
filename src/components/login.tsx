import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { env } from '../env_macro' with { type: 'macro' }
import { useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { jwtDecode } from 'jwt-decode'
import { GOOGLE_ID_PARAM, GOOGLE_LOGIN_ENDPOINT, isLoginResponse, LOGIN_ENDPOINT, type Uuid } from '../sharedtypes'

export function Login({ setUuid }: { setUuid: Dispatch<SetStateAction<Uuid | null>> }) {
    const onError = () => {
        window.location.href = '/' // error page?
    }

    const onGoogleLoginSuccess = ({ credential }: CredentialResponse) => {
        const sub = credential ? jwtDecode(credential).sub : undefined
        if (sub) {
            fetch(`/api/${GOOGLE_LOGIN_ENDPOINT}?${GOOGLE_ID_PARAM}=${sub}`)
                .then(response => {
                    if (response.status === 200) {
                        return response.json()
                    }
                    return Promise.reject()
                })
                .then(body => {
                    if (isLoginResponse(body)) {
                        setUuid(body.uuid)
                    } else {
                        return Promise.reject()
                    }
                })
                .catch(onError)
        }
    }

    const googleLoginButton = (
        <div className='google-login'>
            <GoogleLogin
                onSuccess={onGoogleLoginSuccess}
                onError={onError}
                context='use'
                theme='filled_black'
                shape='pill'
                width='200px'
            />
        </div>
    )

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const onSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        fetch(`/api/${LOGIN_ENDPOINT}`,
            {
                body: JSON.stringify({ username, password }),
                method: 'POST'
            }
        )
            .then(response => {
                if (response.status === 200) {
                    return response.json()
                }
                return Promise.reject()
            })
            .then(body => {
                if (isLoginResponse(body)) {
                    setUuid(body.uuid)
                } else {
                    return Promise.reject()
                }
            })
            .catch(onError)
    }

    const onUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
        const username = event.target.value
        if (username.length <= 16) {
            if (/^[A-Za-z0-9_]*$/.test(username)) {
                setUsername(username)
            }
        }
    }

    const onPasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
        const password = event.target.value
        if (password.length <= 16) {
            if (/^[A-Za-z0-9_]*$/.test(password)) {
                setPassword(password)
            }
        }
    }

    return (
        <GoogleOAuthProvider clientId={env('GOOGLE_CLIENT_ID')}>
            <form onSubmit={onSubmit}>
                <div className='login-panel'>
                    <h1>Log In</h1>
                    <div className='login-fields'>
                        <label>Username</label>
                        <input value={username} onChange={onUsernameChange} />
                        <label>Password</label>
                        <input type='password' value={password} onChange={onPasswordChange} />
                    </div>
                    <div>
                        <button className='login-button' type='submit'>Log in</button>
                        <button className='login-button'>Sign Up</button>
                    </div>
                    {googleLoginButton}
                </div>
            </form>
        </GoogleOAuthProvider>
    )
}