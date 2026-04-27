import { Navigate, Route, Routes } from 'react-router-dom';
import { AccessKeyPage } from '@/pages/access';
import { ResumeIntakePage } from '@/pages/intake';
import { ProfileConfirmPage } from '@/pages/profile-confirm';
import { WorkbenchPage } from '@/pages/workbench';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<AccessKeyPage />} />
      <Route path="/intake" element={<ResumeIntakePage />} />
      <Route path="/confirm-profile" element={<ProfileConfirmPage />} />
      <Route path="/workspace" element={<WorkbenchPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
