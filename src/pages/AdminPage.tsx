import React from "react";
import { useNavigate } from "react-router-dom";
import { AdminDashboard } from "../components/admin/AdminDashboard";

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-zinc-100">
      <AdminDashboard onClose={() => navigate("/editor")} />
    </div>
  );
};
