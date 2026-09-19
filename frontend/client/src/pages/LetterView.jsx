import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import { IconAlert, IconPrinter } from '../components/ui/icons'
import LetterDocument from '../components/LetterDocument'
import { apiErrorMessage } from '../lib/apiError'

/** One issued letter, with a button to save it as a PDF. */
export default function LetterView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [letter, setLetter] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let current = true
    API.get(`/letters/${id}`)
      .then(res => current && setLetter(res.data.letter))
      .catch(err => current && setError(apiErrorMessage(err, 'Could not load that letter')))
    return () => { current = false }
  }, [id])

  const issued = letter?.status === 'issued'

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        <div className="no-print">
          <PageHeader
            title={letter?.title || 'Letter'}
            subtitle={letter ? `${letter.userName}${letter.number ? ` · ${letter.number}` : ''}` : null}
            actions={
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => navigate(-1)}>Back</Button>
                {issued && (
                  <Button onClick={() => window.print()}>
                    <IconPrinter className="h-4 w-4" />
                    Download PDF
                  </Button>
                )}
              </div>
            }
          />
        </div>

        {error ? (
          <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
        ) : !letter ? (
          <Skeleton className="h-[36rem] rounded-card" />
        ) : issued ? (
          <LetterDocument letter={letter} />
        ) : (
          <EmptyState icon={<IconAlert className="h-6 w-6" />} title="This letter has not been issued" description={letter.note || 'HR has not answered this request yet.'} />
        )}
      </div>
    </PageShell>
  )
}
