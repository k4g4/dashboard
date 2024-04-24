import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import {
    Fragment,
    useContext, useState, type ChangeEvent, type Dispatch,
    type FormEvent, type MouseEvent, type SetStateAction
} from 'react'
import { useAsyncEffect } from 'use-async-effect'
import {
    apiErrorSchema,
    BIO_ENDPOINT, bioBodySchema, bioResponseSchema, DELETE_GALLERY_ENDPOINT, IMAGE_NAME_PARAM,
    LIST_GALLERY_ENDPOINT, listGalleryResponseSchema, UPLOAD_GALLERY_ENDPOINT, UUID_PARAM,
} from '../api_schema'
import { ICONS } from '../components/icons'
import { UpdateErrorContext } from '../components/error'
import type { z } from 'zod'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='home'>
        <Bio />
        <Gallery />
    </Page>
)

type Dir = 'left' | 'right'

function Bio() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)

    const [bio, setBio] = useState<string>()
    const [editing, setEditing] = useState(false)
    const [reload, setReload] = useState(false)

    useAsyncEffect(async isMounted => {
        const response = await fetch(`/api/${BIO_ENDPOINT}?${UUID_PARAM}=${uuid}`)
        if (response.status === 404) {
            updateError()
            return
        }
        const body = await response.json()
        if (isMounted()) {
            const bioResponse = bioResponseSchema.safeParse(body)
            if (bioResponse.success) {
                setBio(bioResponse.data.bio ?? undefined)
            } else {
                const apiError = apiErrorSchema.safeParse(body)
                updateError(apiError.success ? apiError.data.error : undefined)
            }
        }
    }, [reload])

    const onUpdateBio = () => setEditing(editing => !editing)

    const [newBio, setNewBio] = useState<string>()

    const onBioChange = (event: ChangeEvent<HTMLTextAreaElement>) => setNewBio(event.target.value)

    const onBioSubmit = async (event: FormEvent) => {
        event.preventDefault()

        const sanitizedBio = newBio ? newBio.replaceAll('\'', '\'\'') : bio ?? ''
        const body: z.infer<typeof bioBodySchema> = { uuid, bio: sanitizedBio }
        const response = await fetch(`/api/${BIO_ENDPOINT}`, { method: 'POST', body: JSON.stringify(body) })
        if (response.status === 200) {
            setEditing(false)
            setReload(reload => !reload)
        } else {
            try {
                const body = await response.json()
                const apiError = apiErrorSchema.safeParse(body)
                updateError(apiError.success ? apiError.data.error : undefined)
            } catch {
                updateError()
            }
        }
    }

    const formattedBio = (
        bio ?
            bio
                .split('\n')
                .map((line, i) => (
                    <Fragment key={i}>
                        {line}
                        <br />
                    </Fragment>
                ))
            :
            <i>No bio provided.</i>
    )

    return (
        <div className='section'>
            <h1>Bio</h1>
            <div className='section-header bio-header'>
                <button className='icon-button update-bio-button' onClick={onUpdateBio} title='Update Bio'>
                    {ICONS.EDIT}
                </button>
            </div>
            {
                !editing ?
                    <p className='bio'>{formattedBio}</p>
                    :
                    <form onSubmit={onBioSubmit}>
                        <div className='bio-editor'>
                            <textarea
                                value={newBio ?? bio}
                                className='bio-editor-field'
                                onChange={onBioChange}
                                placeholder={!newBio ? 'Say something about yourself...' : undefined}
                            >
                            </textarea>
                            <button className='button bio-submit-button' type='submit'>Submit</button>
                        </div>
                    </form>
            }
        </div>
    )
}

function Gallery() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)

    const [images, setImages] = useState<string[]>([])
    const [imageIndex, setImageIndex] = useState(0)
    const [fullscreen, setFullscreen] = useState(false)
    const [reload, setReload] = useState(false)

    const decrementImageIndex = () => {
        setImageIndex(index => index === 0 ? (images.length - 1) : index - 1)
    }

    const incrementImageIndex = () => {
        setImageIndex(index => (index + 1) % images.length)
    }

    useAsyncEffect(async isMounted => {
        const response = await fetch(`/api/${LIST_GALLERY_ENDPOINT}?${UUID_PARAM}=${uuid}`)
        const body = await response.json()
        if (isMounted()) {
            const listGalleryResponse = listGalleryResponseSchema.safeParse(body)
            if (listGalleryResponse.success) {
                setImages(listGalleryResponse.data)
            } else {
                const apiError = apiErrorSchema.safeParse(body)
                updateError(apiError.success ? apiError.data.error : undefined)
            }
        }
    }, [reload])

    const imageIndexCaption = images.length ? `Image ${imageIndex + 1} / ${images.length}` : ''

    // looks hacky, but this is what mozilla recommends!
    const onUpload = (event: MouseEvent<HTMLButtonElement>) => {
        const uploader = document.querySelector<HTMLInputElement>('input[type="file"]')!

        uploader.addEventListener('change', async function () {
            let body = new FormData()
            body.append('uuid', uuid)
            if (uploader.files) {
                const max = uploader.files.length < 8 ? uploader.files.length : 8
                for (let i = 0; i < max; i++) {
                    body.append(`image_${i}`, uploader.files[i])
                }
            } else {
                updateError('no files provided')
            }

            const response = await fetch(`/api/${UPLOAD_GALLERY_ENDPOINT}`, { method: 'POST', body })
            if (response.status === 200) {
                setImageIndex(0)
                setReload(reload => !reload)
            } else {
                try {
                    const body = await response.json()
                    const apiError = apiErrorSchema.safeParse(body)
                    updateError(apiError.success ? apiError.data.error : undefined)
                } catch {
                    updateError()
                }
            }
        })

        uploader.click()
    }

    const onDelete = async () => {
        if (!images.length) {
            updateError('no image to delete')
            return
        }
        const name = images[imageIndex].slice(images[imageIndex].lastIndexOf('/') + 1)
        const params = new URLSearchParams({ [UUID_PARAM]: uuid, [IMAGE_NAME_PARAM]: name })
        const response = await fetch(`/api/${DELETE_GALLERY_ENDPOINT}?${params}`)
        if (response.status === 200) {
            setImageIndex(0)
            setReload(reload => !reload)
        } else {
            try {
                const body = await response.json()
                const apiError = apiErrorSchema.safeParse(body)
                updateError(apiError.success ? apiError.data.error : undefined)
            } catch {
                updateError()
            }
        }
    }

    return (
        <div className='section gallery'>
            <h1>Gallery</h1>
            <div className='section-header gallery-header'>
                <input type='file' accept='image/*' multiple />
                <button className='icon-button upload-button' onClick={onUpload} title='Upload'>
                    {ICONS.UPLOAD}
                </button>
                <button className='icon-button delete-button' onClick={onDelete} title='Delete'>
                    {ICONS.XMARK}
                </button>
            </div>
            <div className='viewer'>
                <Arrow dir='left' onArrowClick={decrementImageIndex} hide={fullscreen} />
                <Image src={images.at(imageIndex)} fullscreen={fullscreen} setFullscreen={setFullscreen} />
                <Arrow dir='right' onArrowClick={incrementImageIndex} hide={fullscreen} />
            </div>
            <p className='image-index'>{imageIndexCaption}</p>
        </div>
    )
}

type ImageProps = { src: string | undefined, fullscreen: boolean, setFullscreen: Dispatch<SetStateAction<boolean>> }
function Image({ src, fullscreen, setFullscreen }: ImageProps) {
    return (
        <div className={'image' + (fullscreen ? ' fullscreen' : '')}>
            <img src={src ?? 'upload.jpg'} onClick={() => setFullscreen(fs => src ? !fs : false)} />
        </div >
    )
}

function Arrow({ dir, onArrowClick, hide }: { dir: Dir, onArrowClick: () => void, hide: boolean }) {
    return !hide && (
        <button className={`arrow-button ${dir}`} onClick={onArrowClick}>{dir === 'left' ? '<' : '>'}
        </button>
    )
}