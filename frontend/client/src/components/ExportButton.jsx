import { useState } from 'react'
import toast from 'react-hot-toast'
import API from '../api/axios'
import Button from './ui/Button'
import { apiErrorMessage } from '../lib/apiError'

/**
 * Download a CSV from the API.
 *
 * The request needs the sign-in header, so it cannot be a plain link: the
 * file is fetched, then handed to the browser to save under the server's
 * own file name.
 */
export default function ExportButton({ path, params = {}, label = 'Export CSV', fallbackName = 'export.csv', size = 'sm' }) {
  const [busy, setBusy] = useState(false)

  const download = async () => {
    setBusy(true)
    try {
      const res = await API.get(path, { params, responseType: 'blob' })
      const disposition = res.headers?.['content-disposition'] || ''
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] || fallbackName
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`${name} downloaded`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Export failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button size={size} variant="outline" loading={busy} onClick={download}>
      {label}
    </Button>
  )
}
