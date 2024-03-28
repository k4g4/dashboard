import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { env } from '../env_macro' with { type: 'macro' }
import type { Dispatch, SetStateAction } from 'react'
import { jwtDecode } from 'jwt-decode'
import { GoogleidToUuidEndpoint, isGoogleidToUuidBody, type Uuid } from '../sharedtypes'

export function Login({ setUuid }: { setUuid: Dispatch<SetStateAction<Uuid | null>> }) {
    const onLoginSuccess = ({ credential }: CredentialResponse) => {
        const sub = credential ? jwtDecode(credential).sub : undefined
        if (sub) {
            fetch(`/api/${GoogleidToUuidEndpoint}`).then(response => {
                response.json().then(body => {
                    if (isGoogleidToUuidBody(body)) {
                        setUuid(body.uuid)
                    } else {
                        console.log('error!')
                    }
                })
            })
        }
    }

    return (
        <GoogleOAuthProvider clientId={env('GOOGLE_CLIENT_ID')}>
            <GoogleLogin
                onSuccess={onLoginSuccess}
                onError={() => window.location.href = '/'} // error page?
                context='use'
                theme='filled_black'
                shape='pill'
                width='200px'
            />
        </GoogleOAuthProvider>
    )
}