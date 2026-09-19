import { Select } from './Field'
import { PAGE_SIZES } from '../../lib/paging'

/** "10 per page" … "100 per page", sat above a list. */
export default function PageSizeSelect({ value, onChange, className = 'w-36' }) {
  return (
    <div className={className}>
      <Select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label="Rows per page"
        className="py-2 text-sm"
      >
        {PAGE_SIZES.map(n => <option key={n} value={n}>{n} per page</option>)}
      </Select>
    </div>
  )
}
