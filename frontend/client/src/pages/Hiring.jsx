import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import API from '../api/axios'
import PageShell from '../components/ui/PageShell'
import PageHeader from '../components/ui/PageHeader'
import Card, { CardTitle } from '../components/ui/Card'
import Button from '../components/ui/Button'
import Skeleton from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'
import Pagination from '../components/ui/Pagination'
import PageSizeSelect from '../components/ui/PageSizeSelect'
import TabPills from '../components/ui/TabPills'
import { Select } from '../components/ui/Field'
import { IconAlert, IconCheck, IconPlus, IconUsers } from '../components/ui/icons'
import CandidateForm from '../components/CandidateForm'
import CandidateList from '../components/CandidateList'
import { apiErrorMessage } from '../lib/apiError'
import { useLiveRefresh } from '../lib/liveRefresh'
import { usePageSize } from '../lib/paging'
import { can } from '../lib/permissions'
import { getUser } from '../store/authStore'

const STATUS_LABEL = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected' }

/**
 * New joiners, before they are accounts.
 *
 * A manager fills this in once; an admin approves it and the account exists
 * with the record already in it. Nothing is retyped, and nobody is created
 * by mistake — a candidate who never joins simply stays a rejected row.
 */
export default function Hiring({ user = getUser() }) {
  const [params] = useSearchParams()
  const mayPropose = can(user, 'hiring')
  const mayDecide = can(user, 'approvals')

  // Approvals used to be a Workspace tab of its own showing this same list,
  // filtered to what waits on a decision. It is a view of this page now, kept
  // in the address as ?view=decide. Somebody who may only decide gets that
  // view whatever the address says, and no switch to a view they cannot use.
  const decide = mayDecide && (params.get('view') === 'decide' || !mayPropose)

  const views = mayPropose && mayDecide && (
    <TabPills
      label="Which candidates"
      active={decide ? 'decide' : 'all'}
      className="mb-5"
      items={[
        { key: 'all', label: 'All candidates', icon: IconUsers, to: { search: '' } },
        { key: 'decide', label: 'Waiting for your decision', icon: IconCheck, to: { search: '?view=decide' } }
      ]}
    />
  )

  // Its own filter, page and page size per view, so switching starts that
  // view afresh rather than carrying the other one's filter across
  return (
    <Candidates
      key={decide ? 'decide' : 'all'}
      decide={decide}
      title={decide && !mayPropose ? 'Approvals' : 'Hiring'}
      views={views}
    />
  )
}

function Candidates({ decide, title, views }) {
  // Reload in place when something new may have happened — see liveRefresh
  const live = useLiveRefresh()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState(decide ? 'pending' : '')
  const [page, setPage] = useState(1)
  const [size, setSize] = usePageSize(decide ? 'hiring-approvals' : 'hiring')
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => {
    const query = new URLSearchParams({ page: String(page), limit: String(size) })
    if (status) query.set('status', status)

    return API.get(`/hiring?${query}`)
      .then(res => setData(res.data))
      .catch(err => setError(apiErrorMessage(err, 'Could not load this')))
  }, [page, size, status])

  useEffect(() => {
    load()
  }, [load, live])

  if (error) {
    return (
      <PageShell>
        <PageHeader title={title} />
        {views}
        <EmptyState icon={<IconAlert className="h-6 w-6" />} tone="danger" title={error} />
      </PageShell>
    )
  }

  if (!data) {
    return (
      <PageShell>
        <Skeleton className="mb-2 h-9 w-44" />
        <Skeleton className="mb-7 h-4 w-80" />
        {views}
        <Skeleton className="h-80 rounded-card" />
      </PageShell>
    )
  }

  const waiting = data.pendingCount || 0

  return (
    <PageShell>
      <PageHeader
        title={title}
        subtitle={
          decide
            ? 'New joinings a manager has put forward. Approving makes the account.'
            : 'Put somebody forward, and follow what happened to them.'
        }
        actions={
          !decide && (
            <Button onClick={() => setAdding(true)}>
              <IconPlus className="h-4 w-4" />
              New joining
            </Button>
          )
        }
      />

      {views}

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div>
            <CardTitle className="mb-0">
              {decide ? 'Waiting on you' : 'Your submissions'}
            </CardTitle>
            <p className="mt-1 text-xs text-content-subtle">
              {waiting > 0
                ? `${waiting} ${waiting === 1 ? 'person is' : 'people are'} waiting on a decision.`
                : 'Nothing is waiting on a decision.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data.total > 10 && (
              <PageSizeSelect
                value={size}
                onChange={n => {
                  setSize(n)
                  setPage(1)
                }}
              />
            )}
            <div className="w-40">
              <Select
                value={status}
                onChange={e => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
                aria-label="Filter by status"
                className="py-2 text-sm"
              >
                <option value="">All of them</option>
                {(data.statuses || []).map(s => (
                  <option key={s} value={s}>{STATUS_LABEL[s] || s}</option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {data.candidates.length === 0 ? (
          <div className="px-4 pb-6 md:px-6">
            <EmptyState
              icon={<IconUsers className="h-6 w-6" />}
              title={decide ? 'Nothing waiting' : 'Nobody put forward yet'}
              description={
                decide
                  ? 'When a manager puts somebody forward, they land here.'
                  : 'Fill in a new joining and an admin will approve it.'
              }
              action={
                !decide && (
                  <Button onClick={() => setAdding(true)}>
                    <IconPlus className="h-4 w-4" />
                    New joining
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <CandidateList
            candidates={data.candidates}
            canDecide={data.canDecide}
            maySeePay={data.maySeePay}
            onChanged={load}
          />
        )}

        {data.totalPages > 1 && (
          <div className="border-t border-line px-4 py-3 md:px-6">
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              limit={data.limit || size}
              onPage={setPage}
            />
          </div>
        )}
      </Card>

      <AnimatePresence>
        {adding && (
          <CandidateForm
            teams={data.teams || []}
            maySeePay={data.maySeePay}
            onClose={() => setAdding(false)}
            onSubmitted={load}
          />
        )}
      </AnimatePresence>
    </PageShell>
  )
}
