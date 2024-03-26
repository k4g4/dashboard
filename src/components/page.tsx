import React, { type PropsWithChildren } from "react";
import { Navbar } from "./navbar";

export function Page({ children }: PropsWithChildren) {
    return (
        <React.StrictMode>
            <Navbar />
            <div className='page-container'>
                {children}
            </div>
        </React.StrictMode>
    )
}