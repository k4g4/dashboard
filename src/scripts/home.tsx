import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import {
    Fragment,
    useContext, useRef, useState, type ChangeEvent, type Dispatch,
    type FormEvent, type MouseEvent, type SetStateAction
} from 'react'
import { useAsyncEffect } from 'use-async-effect'
import * as schema from '../api_schema'
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
        const response = await schema.apiFetch('bio', { params: { uuid }, schema: schema.bioResponse, updateError })
        if (response && isMounted()) {
            setBio(response.bio ?? undefined)
        }
    }, [reload])

    const onUpdateBio = () => setEditing(editing => !editing)

    const [newBio, setNewBio] = useState<string>()

    const onBioChange = (event: ChangeEvent<HTMLTextAreaElement>) => setNewBio(event.target.value)

    const onBioSubmit = async (event: FormEvent) => {
        event.preventDefault()

        const sanitizedBio = newBio ? newBio.replaceAll('\'', '\'\'') : bio ?? ''
        const body: z.infer<typeof schema.bioBody> = { uuid, bio: sanitizedBio }
        if (await schema.apiFetch('bio', { body, updateError })) {
            setEditing(false)
            setReload(reload => !reload)
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
    const uploader = useRef<HTMLInputElement>(null)

    const decrementImageIndex = () => {
        setImageIndex(index => index === 0 ? (images.length - 1) : index - 1)
    }

    const incrementImageIndex = () => {
        setImageIndex(index => (index + 1) % images.length)
    }

    useAsyncEffect(async isMounted => {
        const options = { params: { uuid }, schema: schema.listGalleryResponse, updateError }
        const response = await schema.apiFetch('gallery', options)
        if (response && isMounted()) {
            setImages(response)
        }
    }, [reload])

    const imageIndexCaption = images.length ? `Image ${imageIndex + 1} / ${images.length}` : ''

    // looks hacky, but this is what mozilla recommends!
    const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const body = new FormData()
        body.append('uuid', uuid)
        if (event.target.files) {
            const max = event.target.files.length < 8 ? event.target.files.length : 8
            for (let i = 0; i < max; i++) {
                body.append(`image_${i}`, event.target.files[i])
            }
        } else {
            updateError('no files provided')
        }

        if (await schema.apiFetch('gallery', { body, updateError })) {
            setImageIndex(0)
            setReload(reload => !reload)
        }
    }

    const onDelete = async () => {
        if (!images.length) {
            updateError('no image to delete')
            return
        }
        const name = images[imageIndex].slice(images[imageIndex].lastIndexOf('/') + 1)
        if (await schema.apiFetch('deletegallery', { params: { uuid, name }, updateError })) {
            setImageIndex(0)
            setReload(reload => !reload)
        }
    }

    return (
        <div className='section gallery'>
            <h1>Gallery</h1>
            <div className='section-header gallery-header'>
                <input type='file' accept='image/*' multiple onChange={onUpload} ref={uploader} />
                <button className='icon-button upload-button' onClick={() => uploader.current?.click()} title='Upload'>
                    {ICONS.UPLOAD}
                </button>
                <button className='icon-button delete-button danger-button' onClick={onDelete} title='Delete'>
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