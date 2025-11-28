import { useState } from 'react'
import { getAllPDFRecords, deletePDFRecord, savePDFRecord, generatePDFId, PDFFileRecord } from '../../utils/indexedDB'
import * as pdfjsLib from 'pdfjs-dist'

// Workerの設定
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

export const usePDFRecords = () => {
  const [pdfRecords, setPdfRecords] = useState<PDFFileRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadPDFRecords = async () => {
    try {
      setLoading(true)
      const records = await getAllPDFRecords()
      setPdfRecords(records)
    } catch (error) {
      console.error('Failed to load PDFs:', error)
      setErrorMessage('Failed to load PDF list')
    } finally {
      setLoading(false)
    }
  }

  // サムネイルを生成
  const generateThumbnail = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer()
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise

    const page = await pdf.getPage(1)
    const viewport = page.getViewport({ scale: 0.5 })

    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas context not available')

    canvas.height = viewport.height
    canvas.width = viewport.width

    await page.render({
      canvasContext: context,
      viewport: viewport,
    }).promise

    return canvas.toDataURL('image/jpeg', 0.7)
  }

  const handleFileSelect = async (onSelectPDF: (record: PDFFileRecord) => void) => {
    setUploading(true)
    try {
      let file: File | null = null

      if ('showOpenFilePicker' in window) {
        try {
          const [fileHandle] = await (window as any).showOpenFilePicker({
            types: [
              {
                description: 'PDF Files',
                accept: {
                  'application/pdf': ['.pdf'],
                },
              },
            ],
            multiple: false,
          })
          file = await fileHandle.getFile()
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('File picker failed:', error)
          }
          setUploading(false)
          return
        }
      } else {
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = 'application/pdf'

          // ファイル選択イベント
          input.onchange = (e) => {
            const selectedFile = (e.target as HTMLInputElement).files?.[0]
            resolve(selectedFile || null)
          }

          // キャンセルイベント（ファイル選択ダイアログを閉じた時）
          input.oncancel = () => {
            resolve(null)
          }

          // フォーカスが戻った時にキャンセル判定（フォールバック）
          // ファイル選択ダイアログが開いている間はフォーカスが外れるため、
          // 一定時間後にフォーカスが戻ってきてファイルが選択されていない場合はキャンセルと判定
          let focusCheckTimeout: NodeJS.Timeout | null = null
          const handleFocus = () => {
            focusCheckTimeout = setTimeout(() => {
              if (!input.files || input.files.length === 0) {
                resolve(null)
              }
            }, 300)
          }

          // クリーンアップ
          const cleanup = () => {
            if (focusCheckTimeout) clearTimeout(focusCheckTimeout)
            window.removeEventListener('focus', handleFocus)
          }

          // onchangeまたはoncancelが呼ばれたらクリーンアップ
          const originalOnChange = input.onchange
          input.onchange = (e) => {
            cleanup()
            if (originalOnChange) originalOnChange(e)
          }
          const originalOnCancel = input.oncancel
          input.oncancel = () => {
            cleanup()
            if (originalOnCancel) originalOnCancel()
          }

          window.addEventListener('focus', handleFocus, { once: true })
          input.click()
        })

        if (!file) {
          setUploading(false)
          return
        }
      }

      // ファイルサイズチェック（100MBまで）
      if (file.size > 100 * 1024 * 1024) {
        setErrorMessage('ファイルサイズが大きすぎます（最大100MB）')
        setUploading(false)
        return
      }

      const fileName = file.name
      const id = generatePDFId(fileName)

      // サムネイルを生成
      const thumbnail = await generateThumbnail(file)

      // ファイル全体をBlobとして保存（v6から）
      const arrayBuffer = await file.arrayBuffer()
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' })

      const newRecord: PDFFileRecord = {
        id,
        fileName,
        fileData: blob,
        thumbnail,
        lastOpened: Date.now(),
        drawings: {},
      }

      await savePDFRecord(newRecord)
      await loadPDFRecords()

      // 自動的に開く
      onSelectPDF(newRecord)
    } catch (error) {
      console.error('Failed to add PDF:', error)
      setErrorMessage(`Failed to add PDF: ${error}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteRecord = async (id: string) => {
    try {
      await deletePDFRecord(id)
      await loadPDFRecords()
    } catch (error) {
      console.error('Failed to delete:', error)
      setErrorMessage('Failed to delete')
    }
  }

  return {
    pdfRecords,
    loading,
    uploading,
    errorMessage,
    setErrorMessage,
    loadPDFRecords,
    handleFileSelect,
    handleDeleteRecord
  }
}
