import { Activity, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import TabPills from '../components/ui/TabPills'
import { IconList, IconShield, IconUser } from '../components/ui/icons'
import Employees from './Employees'
import People from './People'
import AdminPanel from './AdminPanel'
import { cn } from '../lib/cn'
import { GUTTER } from '../lib/pageWidth'
import { can } from '../lib/permissions'

const TABS = [
  {
    key: 'activity',
    label: 'Activity',
    icon: IconList,
    allowed: (user) => can(user, 'employees'),
    render: () => <Employees />
  },
  {
    key: 'records',
    label: 'HR details',
    icon: IconUser,
    allowed: (user) => can(user, 'records'),
    render: (user) => <People user={user} />
  },
  {
    key: 'access',
    label: 'Access',
    icon: IconShield,
    allowed: (user) => user?.role === 'admin' && can(user, 'people'),
    render: (user) => <AdminPanel user={user} />
  }
]

/** The tabs this person may open, in order. */
const peopleTabsFor = (user) => TABS.filter(tab => tab.allowed(user))

/**
 * Everybody in the company, on one page.
 *
 * The same people were on three screens — the roster under Team, their HR
 * details and the admin panel under Workspace — and which one held what was
 * something you had to remember. They are tabs of one page now, and each
 * person only sees the tabs their role opens.
 */
export default function PeopleHub({ user }) {
  const tabs = peopleTabsFor(user)
  const [params] = useSearchParams()

  // An old link, or a tab this role cannot open, lands on the first one it can
  const asked = params.get('tab')
  const active = tabs.some(tab => tab.key === asked) ? asked : tabs[0]?.key

  /**
   * Tabs already opened stay alive underneath, hidden — the same as the
   * Workspace tabs: coming back shows what was loaded, and its effects
   * refetch in the background.
   */
  const [opened, setOpened] = useState([])
  if (active && !opened.includes(active)) {
    setOpened([...opened, active])
  }

  return (
    <>
      <div className={cn(GUTTER, 'pt-6')}>
        <div>
          <p className="eyebrow mb-2.5">People</p>
          <TabPills
            label="People"
            active={active}
            items={tabs.map(tab => ({ ...tab, to: { search: `?tab=${tab.key}` } }))}
          />
        </div>
      </div>

      {/* A tab whose permission went away is dropped, not just hidden */}
      {tabs
        .filter(tab => opened.includes(tab.key))
        .map(tab => (
          <Activity key={tab.key} mode={tab.key === active ? 'visible' : 'hidden'}>
            {tab.render(user)}
          </Activity>
        ))}
    </>
  )
}
