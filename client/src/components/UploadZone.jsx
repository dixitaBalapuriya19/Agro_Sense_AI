import { useRef, useState } from 'react'
import { motion } from 'framer-motion' // eslint-disable-line no-unused-vars
import { t } from '../translations'
import { LeafIcon } from './Icons'

export default function UploadZone({ onImageSelected, language = 'english' }) {
    const fileInputRef = useRef(null)
    const [isDragOver, setIsDragOver] = useState(false)

    const handleDrop = (e) => {
        e.preventDefault()
        setIsDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file?.type.startsWith('image/')) {
            processFile(file)
        }
    }

    const processFile = (file) => {
        const reader = new FileReader()
        reader.onload = (event) => {
            onImageSelected(event.target.result)
        }
        reader.readAsDataURL(file)
    }

    return (
        <section className="upload-container">
            <motion.div
                className="upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragOver(true)
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                data-dragover={isDragOver ? 'true' : 'false'}
            >
                <motion.div
                    animate={{
                        y: isDragOver ? -8 : 0,
                        color: isDragOver ? 'var(--ui-accent)' : 'var(--ui-text-muted)'
                    }}
                >
                    <motion.span
                        className="upload-dropzone__icon"
                        animate={{ scale: isDragOver ? 1.2 : 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 10 }}
                    >
                        <LeafIcon size={56} color={isDragOver ? 'var(--ui-accent)' : 'var(--ui-text-muted)'} />
                    </motion.span>

                    <h2 className="upload-dropzone__title">
                        {language === 'gujarati' ? 'તમારો નમૂનો અપલોડ કરો' : 'Upload Your Specimen'}
                    </h2>

                    <p className="upload-dropzone__desc">
                        {t('dragDropImage', language)}
                    </p>

                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="upload-dropzone__meta"
                    >
                        {language === 'gujarati' ? 'PNG, JPG, WEBP (10MB સુધી)' : 'PNG, JPG, WEBP (up to 10MB)'}
                    </motion.div>

                    <span className="upload-dropzone__cta">
                        {language === 'gujarati' ? 'ચિત્ર પસંદ કરો' : 'Choose Image'}
                    </span>
                </motion.div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                        if (e.target.files[0]) processFile(e.target.files[0])
                    }}
                    hidden
                />
            </motion.div>
        </section>
    )
}
