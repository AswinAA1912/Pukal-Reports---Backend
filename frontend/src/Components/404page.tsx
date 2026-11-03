import React from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "@mui/icons-material";

interface PageNotFoundProps {
  pageLoading?: boolean;
  pageLoadingOn?: () => void;
  pageLoadingOff?: () => void;
  setActiveCategory?: (category: string) => void;
}

export default function PageNotFound({ 
  pageLoading = false,
  pageLoadingOn = () => {},
  pageLoadingOff = () => {},
  setActiveCategory
}: PageNotFoundProps): React.JSX.Element {
  const navigate = useNavigate();

  React.useEffect(() => {
    pageLoadingOn();
    const timer = setTimeout(() => {
      pageLoadingOff();
    }, 300);
    return () => clearTimeout(timer);
  }, [pageLoadingOn, pageLoadingOff]);

  const goHome = () => {
    // Show loading if available
    if (pageLoadingOn) pageLoadingOn();
    
    // Set active category to "all" if function is provided
    if (setActiveCategory) {
      setActiveCategory("all");
    }
    
    // Navigate to the home page (which redirects to "all")
    navigate("/");
    
    // Hide loading after a short delay
    if (pageLoadingOff) {
      setTimeout(pageLoadingOff, 500);
    }
  };

  if (pageLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        }}
      >
        <div
          style={{
            padding: "20px",
            borderRadius: "12px",
            background: "white",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
        // background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
      }}
    >
      {/* Outer Circle */}
      <div
        style={{
          width: "160px",
          height: "160px",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "32px",
          background: "linear-gradient(135deg, #FFE6EE, #FFB3C6)",
          boxShadow: "12px 12px 24px rgba(0,0,0,0.08), -8px -8px 18px rgba(255,255,255,0.9)",
          position: "relative",
        }}
      >
        {/* Inner Circle */}
        <div
          style={{
            width: "112px",
            height: "112px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.9), rgba(255,255,255,0.3))",
            boxShadow: "inset 6px 6px 10px rgba(0,0,0,0.06), inset -6px -6px 12px rgba(255,255,255,0.6)",
          }}
        >
          <span
            style={{
              fontSize: "40px",
              fontWeight: 700,
              color: "#7B3F6B",
            }}
          >
            404
          </span>
        </div>
        
        {/* Animated border */}
        <div
          style={{
            position: "absolute",
            top: "-4px",
            left: "-4px",
            right: "-4px",
            bottom: "-4px",
            borderRadius: "50%",
            border: "2px dashed #FF8E9E",
            animation: "rotate 20s linear infinite",
          }}
        />
      </div>

      {/* Message */}
      <h1
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: "#333333",
          marginBottom: "12px",
          textAlign: "center",
        }}
      >
        Page Not Found
      </h1>
      <p
        style={{
          fontSize: "16px",
          color: "#6B7280",
          marginBottom: "32px",
          maxWidth: "400px",
          textAlign: "center",
          lineHeight: 1.6,
        }}
      >
        The page you are looking for might have been removed, renamed, or is temporarily unavailable.
      </p>

      {/* Go Home Button */}
      <button
        onClick={goHome}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "10px",
          padding: "12px 28px",
          borderRadius: "28px",
          fontWeight: 600,
          fontSize: "16px",
          cursor: "pointer",
          background: "linear-gradient(135deg, #FFD59E, #FFB347)",
          boxShadow: "6px 6px 14px rgba(0,0,0,0.1), -4px -4px 10px rgba(255,255,255,0.8)",
          border: "none",
          transition: "all 0.3s ease",
          color: "#7B3F6B",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
          e.currentTarget.style.boxShadow = "8px 8px 20px rgba(0,0,0,0.15), -6px -6px 15px rgba(255,255,255,0.8)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "6px 6px 14px rgba(0,0,0,0.1), -4px -4px 10px rgba(255,255,255,0.8)";
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = "translateY(1px)";
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = "translateY(-3px)";
        }}
      >
        {/* Hover effect overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0))",
            opacity: 0,
            transition: "opacity 0.3s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0";
          }}
        />
        
        <Home 
          style={{ 
            fontSize: 22, 
            color: "#7B3F6B",
            transition: "transform 0.3s ease"
          }}
        />
        <span style={{ color: "#7B3F6B" }}>Go to Home</span>
      </button>

      {/* Optional: Additional navigation options */}
      <div
        style={{
          marginTop: "24px",
          fontSize: "14px",
          color: "#6B7280",
          textAlign: "center",
        }}
      >
        <p>
          Or you can go back to{" "}
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              color: "#7B3F6B",
              textDecoration: "underline",
              cursor: "pointer",
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: "4px",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(123, 63, 107, 0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            previous page
          </button>
        </p>
      </div>

      {/* Add CSS for animation */}
      <style>
        {`
          @keyframes rotate {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}