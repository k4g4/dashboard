import React, { type PropsWithChildren } from "react";

export function Page({ children }: PropsWithChildren) {
    return (
        <React.StrictMode>
            {children}
        </React.StrictMode>
    )
}