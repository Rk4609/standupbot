import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import toast from "react-hot-toast"
import API from "../api/axios"
import { saveUser } from "../store/authStore"
import AuthLayout from "../components/AuthLayout"
import Button from "../components/ui/Button"
import { Field, Input } from "../components/ui/Field"

export default function Login({ setUser }) {
  const [form, setForm] = useState({ email: "", password: "" })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await API.post("/auth/login", form)
      saveUser(data)
      setUser(data)
      toast.success(`Welcome back, ${data.name}!`)
      navigate("/dashboard")
    } catch (err) {
      toast.error(err.response?.data?.message || "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to keep your team in the loop"
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
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@company.com"
          />
        </Field>

        <Field label="Password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex justify-end">
          <Link
            to="/forgot-password"
            className="text-xs text-brand-600 hover:underline dark:text-brand-400"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" full loading={loading}>
          {loading ? "Signing in..." : "Sign in →"}
        </Button>
      </form>
    </AuthLayout>
  )
}
