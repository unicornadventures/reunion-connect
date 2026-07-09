import React from 'react';

const section = (title: string, items: string[]) => (
  <div className="mb-8">
    <h2 className="font-display text-lg font-bold text-[#0E2240] uppercase tracking-tight mb-3">{title}</h2>
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-[#64748B] leading-relaxed">
          <span className="text-[#E8A93E] font-bold flex-shrink-0">•</span>
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const HelpPage: React.FC = () => (
  <div className="max-w-[800px] mx-auto px-5 py-10">
    <div className="mb-8">
      <h1 className="font-display text-3xl font-bold text-[#0E2240] uppercase tracking-tight mb-2">Help</h1>
      <p className="text-sm text-[#64748B]">A quick guide to using ReunionConnect.</p>
    </div>

    <div className="bg-white rounded-lg border border-[#E2E8F0] p-8 space-y-0">
      {section('Your Profile', [
        'Click "Profile" in the top navigation bar to view and edit your profile.',
        'Add your bio to share what you\'ve been up to since graduation.',
        'Add tags (clubs, sports, dorm hall, etc.) to help classmates find you and see what you had in common.',
        'Upload "Then" and "Now" photos — click the photo area to select a file from your device.',
        'You can also add up to 9 additional photos to your personal gallery. Click a gallery photo to view it full-screen.',
      ])}

      {section('Directory', [
        'The Directory shows all members of your class year.',
        'Click on any classmate\'s name or photo to view their profile.',
        'From a classmate\'s profile, click "View Comments" to see the comments page for that person.',
      ])}

      {section('Leaving Comments', [
        'Navigate to a classmate\'s comments page and type a message in the "Leave a comment" box.',
        'Comments are reviewed before they appear publicly — they show as "Pending" until approved.',
        'You can edit or delete comments you have posted. Editing a comment sends it back for re-approval.',
      ])}

      {section('Events', [
        'Click "Events" in the top navigation to see upcoming reunion events.',
        'Each event shows the date, time, and location.',
        'Event details are managed by your class admin or site administrator.',
      ])}

      {section('Photo Uploads', [
        'Your "Then" photo should be from around your graduation year.',
        'Your "Now" photo shows who you are today.',
        'Photos are stored securely and only visible to logged-in classmates.',
        'Gallery photos appear in a 3-column grid on your profile. Click any photo to open it in full-screen.',
      ])}

      {section('Account & Security', [
        'If you haven\'t registered yet, go to /join and search for your name to claim your account.',
        'Use the "Forgot password" link on the login page to reset your password via email.',
        'Your email address is only visible to you — other classmates see only your name and photos.',
      ])}
    </div>
  </div>
);

export default HelpPage;
