import { useEffect, useState } from 'react'

interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  className?: string
}

const format = (value: number) => String(Math.round(value * 10) / 10)

export function NumberField({
  value,
  onChange,
  min,
  max,
  step = 0.5,
  className,
}: NumberFieldProps) {
  const [text, setText] = useState(() => format(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(format(value))
  }, [value, focused])

  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      className={className}
      value={text}
      onFocus={() => setFocused(true)}
      onChange={(event) => {
        const raw = event.target.value
        setText(raw)
        const parsed = Number(raw)
        // Update the preview as soon as the typed value is valid, but leave a
        // partial entry like "8" or "85." alone instead of clamping it.
        if (
          raw.trim() !== '' &&
          Number.isFinite(parsed) &&
          parsed >= min &&
          parsed <= max
        ) {
          onChange(parsed)
        }
      }}
      onBlur={() => {
        setFocused(false)
        const parsed = Number(text)
        const next =
          text.trim() === '' || !Number.isFinite(parsed)
            ? value
            : Math.min(max, Math.max(min, parsed))
        setText(format(next))
        if (next !== value) onChange(next)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur()
      }}
    />
  )
}
