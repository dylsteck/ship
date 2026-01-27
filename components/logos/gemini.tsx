import * as React from 'react'
import type { SVGProps } from 'react'

const Gemini = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    viewBox="0 0 24 24"
    fill="none"
    {...props}
  >
    <path
      d="M12 24C12 18.8747 16.0294 14.6651 21.0937 14.0852C21.3866 14.0516 21.6844 14.0336 21.9869 14.0321C21.9956 14.032 22.0043 14.032 22.013 14.032C22.6717 14.032 23.3175 14.0851 23.9468 14.1873V13.968C23.9812 13.3151 24 12.6588 24 12C24 5.37258 18.6274 0 12 0C5.37258 0 0 5.37258 0 12C0 18.6274 5.37258 24 12 24Z"
      fill="url(#paint0_radial_gemini)"
    />
    <defs>
      <radialGradient
        id="paint0_radial_gemini"
        cx="0"
        cy="0"
        r="1"
        gradientUnits="userSpaceOnUse"
        gradientTransform="translate(12 12) rotate(90) scale(12)"
      >
        <stop stopColor="#1A73E8" />
        <stop offset="1" stopColor="#6C47FF" />
      </radialGradient>
    </defs>
  </svg>
)

export default Gemini
