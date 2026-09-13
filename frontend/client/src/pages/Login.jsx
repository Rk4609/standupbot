import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import toast from "react-hot-toast"
import API from "../api/axios"
import { saveUser } from "../store/authStore"
import AuthLayout from "../components/AuthLayout"
import Button from "../components/ui/Button"
import { Checkbox, Field, Input } from "../components/ui/Field"
import PasswordToggle from "../components/ui/PasswordToggle"
import { IconLock, IconMail } from "../components/ui/icons"

export default function Login({ setUser }) {
  const [form, setForm] = useState({ email: "", password: "" })
  const [remember, setRemember] = useState(true)
  const [reveal, setReveal] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  // Landing here because a session lapsed should say so. Otherwise the sign-in
  // form appears mid-task with no explanation and reads as the app logging
  // people out at random.
  useEffect(() => {
    if (!params.get('expired')) return

    toast('Your session expired — sign in again', { icon: '🔒' })
    params.delete('expired')
    setParams(params, { replace: true })
  }, [params, setParams])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await API.post("/auth/login", form)
      saveUser(data, { remember })
      setUser(data)
      toast.success(`Welcome back, ${data.name}`)
      navigate("/dashboard")
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Sign in to StandupBot"
      subtitle="Post your standup, track blockers and keep the team aligned."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address">
          <Input
            type="email"
            required
            autoComplete="email"
            icon={IconMail}
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password">
          <Input
            type={reveal ? "text" : "password"}
            required
            autoComplete="current-password"
            icon={IconLock}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            trailing={
              <PasswordToggle revealed={reveal} onToggle={() => setReveal(v => !v)} />
            }
          />
        </Field>

        <div className="flex items-center justify-between gap-3 pt-0.5">
          <Checkbox
            label="Remember me"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" full loading={loading} className="!mt-6">
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  )
}
