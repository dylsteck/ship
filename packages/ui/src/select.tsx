"use client"

import * as React from "react"
import { cn } from "./utils"

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  onValueChange?: (value: string) => void
}

function Select({ className, children, value, onValueChange, onChange, ...props }: SelectProps) {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange?.(e)
    onValueChange?.(e.target.value)
  }

  return (
    <select
      data-slot="select"
      className={cn(
        "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      value={value}
      onChange={handleChange}
      {...props}
    >
      {children}
    </select>
  )
}

interface SelectItemProps extends React.OptionHTMLAttributes<HTMLOptionElement> {}

function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <option
      data-slot="select-item"
      className={cn("py-1.5 px-2", className)}
      {...props}
    >
      {children}
    </option>
  )
}

interface SelectGroupProps extends React.OptgroupHTMLAttributes<HTMLOptGroupElement> {}

function SelectGroup({ className, children, ...props }: SelectGroupProps) {
  return (
    <optgroup
      data-slot="select-group"
      className={cn("", className)}
      {...props}
    >
      {children}
    </optgroup>
  )
}

export { Select, SelectItem, SelectGroup }
