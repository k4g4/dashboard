import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { env } from '../env_macro' with { type: 'macro' }
import type { Dispatch, SetStateAction } from 'react'
import { jwtDecode } from 'jwt-decode'
import { GOOGLE_LOGIN_ENDPOINT, isGoogleLoginBody, type Uuid } from '../sharedtypes'

export function Login({ setUuid }: { setUuid: Dispatch<SetStateAction<Uuid | null>> }) {
    const onLoginSuccess = ({ credential }: CredentialResponse) => {
        const sub = credential ? jwtDecode(credential).sub : undefined
        if (sub) {
            fetch(`/api/${GOOGLE_LOGIN_ENDPOINT}?googleid=${sub}`)
                .then(response => {
                    if (response.status === 200) {
                        return response.json()
                    }
                    return Promise.reject()
                })
                .then(body => {
                    if (isGoogleLoginBody(body)) {
                        setUuid(body.uuid)
                    } else {
                        return Promise.reject()
                    }
                })
                .catch(onError)
        }
    }

    const onError = () => {
        window.location.href = '/' // error page?
    }

    return (
        <GoogleOAuthProvider clientId={env('GOOGLE_CLIENT_ID')}>
            <GoogleLogin
                onSuccess={onLoginSuccess}
                onError={onError}
                context='use'
                theme='filled_black'
                shape='pill'
                width='200px'
            />
        </GoogleOAuthProvider>
    )
}