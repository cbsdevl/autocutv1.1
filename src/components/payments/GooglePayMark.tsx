import React from "react";

interface GooglePayMarkProps {
  className?: string;
  theme?: "dark" | "light"; // dark = white 'Pay' text, light = dark grey '#3c4043' 'Pay' text
  withPill?: boolean; // wraps in official white acceptance pill with border #dadce0
  height?: number;
}

/**
 * Official Google Pay Acceptance Mark ("G Pay")
 * Strictly adheres to Google Pay Brand Guidelines:
 * - Official 4-color Google 'G' icon
 * - 'Pay' text in Roboto/sans-serif (#3c4043 on light, #ffffff on dark)
 * - Never spells out "Google Pay" inside the mark; always "G Pay"
 */
export const GooglePayMark: React.FC<GooglePayMarkProps> = ({
  className = "",
  theme = "light",
  withPill = false,
  height = 24,
}) => {
  const payTextColor = theme === "dark" ? "#ffffff" : "#3c4043";
  const aspectRatio = 58 / 24;
  const width = Math.round(height * aspectRatio);

  const svgContent = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 58 24"
      width={width}
      height={height}
      className="inline-block shrink-0 align-middle select-none"
      aria-label="Google Pay"
      role="img"
    >
      {/* Official Google 'G' Vector Icon */}
      <g transform="translate(1, 1)">
        {/* Blue right bar & upper arc */}
        <path
          fill="#4285F4"
          d="M21.5 11.2c0-.7-.1-1.4-.2-2H11v4.1h5.9c-.3 1.3-1 2.4-2.2 3.1v2.6h3.6c2.1-1.9 3.2-4.7 3.2-7.8z"
        />
        {/* Green bottom arc */}
        <path
          fill="#34A853"
          d="M11 21.9c3 0 5.5-1 7.4-2.7l-3.6-2.6c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.7H1.1v2.7C2.9 19.3 6.7 21.9 11 21.9z"
        />
        {/* Yellow bottom-left arc */}
        <path
          fill="#FBBC05"
          d="M4.7 13c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3V5.7H1.1C.4 7.1 0 8.7 0 10.7s.4 3.6 1.1 5l3.6-2.7z"
        />
        {/* Red top arc */}
        <path
          fill="#EA4335"
          d="M11 4.2c1.6 0 3.1.6 4.2 1.6l3.2-3.2C16.5 1 13.9 0 11 0 6.7 0 2.9 2.6 1.1 6.2l3.6 2.7C5.6 6.2 8.1 4.2 11 4.2z"
        />
      </g>

      {/* Official 'Pay' text */}
      <text
        x="26"
        y="17"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
        fontSize="17"
        fontWeight="600"
        letterSpacing="-0.2px"
        fill={payTextColor}
      >
        Pay
      </text>
    </svg>
  );

  if (withPill) {
    return (
      <span
        className={`inline-flex items-center justify-center px-2 py-1 bg-white rounded-md border border-[#dadce0] shadow-sm ${className}`}
        style={{ minHeight: `${height + 8}px` }}
      >
        {svgContent}
      </span>
    );
  }

  return <span className={`inline-flex items-center ${className}`}>{svgContent}</span>;
};
