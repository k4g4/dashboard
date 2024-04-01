import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import { useContext, useState, type Dispatch, type MouseEvent, type SetStateAction } from 'react'
import { useAsyncEffect } from 'use-async-effect'
import { DELETE_GALLERY_ENDPOINT, IMAGE_NAME_PARAM, isListGalleryResponse, LIST_GALLERY_ENDPOINT, UPLOAD_GALLERY_ENDPOINT, UUID_PARAM } from '../sharedtypes'
import { ICONS } from '../components/icons'
import { unstable_getCurrentPriorityLevel } from '../../build/home'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='home'>
        <Gallery />
    </Page>
)

type Dir = 'left' | 'right'

function Gallery() {
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

    const uuid = useContext(UuidContext)
    useAsyncEffect(async isMounted => {
        const response = await fetch(`/api/${LIST_GALLERY_ENDPOINT}?${UUID_PARAM}=${uuid}`)
        const body = await response.json()
        if (isMounted() && isListGalleryResponse(body)) {
            setImages(body)
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
            }

            const response = await fetch(`/api/${UPLOAD_GALLERY_ENDPOINT}`, { method: 'POST', body })
            if (response.status === 200) {
                setImageIndex(0)
                setReload(reload => !reload)
            } else {
                //
            }
        })

        uploader.click()
    }

    const onDelete = async () => {
        if (!images.length) {
            //
            return
        }
        const name = images[imageIndex].slice(images[imageIndex].lastIndexOf('/') + 1)
        const params = new URLSearchParams({ [UUID_PARAM]: uuid, [IMAGE_NAME_PARAM]: name })
        const response = await fetch(`/api/${DELETE_GALLERY_ENDPOINT}?${params}`)
        if (response.status === 200) {
            setImageIndex(0)
            setReload(reload => !reload)
        } else {
            //
        }
    }

    return (
        <div className='gallery'>
            <h1>Gallery</h1>
            <div className='gallery-header'>
                <input type='file' accept='image/*' multiple />
                <button className='button upload-button' onClick={onUpload}>{ICONS.UPLOAD}</button>
                <button className='button delete-button' onClick={onDelete}>{ICONS.XMARK}</button>
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