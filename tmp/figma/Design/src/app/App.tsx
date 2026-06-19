import { useState } from "react";

type View = "login" | "dashboard" | "directory" | "profile" | "comments";

interface Alumni {
  id: number;
  name: string;
  gradYear: number;
  location: string;
  job: string;
  company: string;
  email: string;
  color: string;
  initials: string;
  bio: string;
}

interface Comment {
  id: number;
  author: string;
  authorInitials: string;
  authorColor: string;
  text: string;
  timestamp: string;
  likes: number;
}

const ALUMNI: Alumni[] = [
  { id: 1, name: "Sarah Mitchell", gradYear: 2004, location: "Austin, TX", job: "Product Manager", company: "Google", email: "sarah.m@email.com", color: "#E91E63", initials: "SM", bio: "Loving life in Austin with my two kids and rescue dog. Can't believe it's been 20 years!" },
  { id: 2, name: "James Rivera", gradYear: 2004, location: "New York, NY", job: "Software Engineer", company: "Meta", email: "james.r@email.com", color: "#3F51B5", initials: "JR", bio: "Still writing code, just with more coffee. NYC never sleeps and neither do I." },
  { id: 3, name: "Priya Patel", gradYear: 2004, location: "Chicago, IL", job: "Physician", company: "Northwestern Medicine", email: "priya.p@email.com", color: "#009688", initials: "PP", bio: "10 years in medicine and still learning every day. Married with triplets — chaos is an understatement." },
  { id: 4, name: "Marcus Johnson", gradYear: 2004, location: "Seattle, WA", job: "Entrepreneur", company: "Founder @ Stackly", email: "marcus.j@email.com", color: "#FF5722", initials: "MJ", bio: "Built two startups, sold one, still grinding on the other. Seattle rain doesn't bother me anymore." },
  { id: 5, name: "Emma Cho", gradYear: 2004, location: "Los Angeles, CA", job: "Film Director", company: "Freelance", email: "emma.c@email.com", color: "#9C27B0", initials: "EC", bio: "Two short films, one feature in post. Living the dream one frame at a time." },
  { id: 6, name: "Tyler Brooks", gradYear: 2004, location: "Denver, CO", job: "Environmental Lawyer", company: "EarthJustice", email: "tyler.b@email.com", color: "#4CAF50", initials: "TB", bio: "Fighting for clean air and water in court. Colorado mountains are my therapy." },
  { id: 7, name: "Aisha Washington", gradYear: 2004, location: "Atlanta, GA", job: "Professor", company: "Georgia Tech", email: "aisha.w@email.com", color: "#FF9800", initials: "AW", bio: "Teaching civil engineering to the next generation. Published 14 papers. Still can't park in one try." },
  { id: 8, name: "Noah Kim", gradYear: 2004, location: "Boston, MA", job: "Data Scientist", company: "MIT Lincoln Lab", email: "noah.k@email.com", color: "#607D8B", initials: "NK", bio: "Turning data into decisions. Running marathons on the weekends — it makes the week easier." },
  { id: 9, name: "Camille Dubois", gradYear: 2004, location: "Portland, OR", job: "Chef / Owner", company: "Maison Dubois", email: "camille.d@email.com", color: "#795548", initials: "CD", bio: "Opened my restaurant in 2019, survived COVID, thriving now. Come visit — I'll cook for you." },
  { id: 10, name: "Jordan Lee", gradYear: 2004, location: "Miami, FL", job: "Financial Advisor", company: "JPMorgan Chase", email: "jordan.l@email.com", color: "#00BCD4", initials: "JL", bio: "Helping people retire well. Miami sun and saltwater keep me sane." },
  { id: 11, name: "Rachel Torres", gradYear: 2004, location: "Phoenix, AZ", job: "Architect", company: "Desert Studio AZ", email: "rachel.t@email.com", color: "#F06292", initials: "RT", bio: "Designing sustainable homes in the desert. If it can survive 115°F it can survive anything." },
  { id: 12, name: "Dev Sharma", gradYear: 2004, location: "San Francisco, CA", job: "VC Partner", company: "Horizon Ventures", email: "dev.s@email.com", color: "#7986CB", initials: "DS", bio: "Invested in 30 companies, three unicorns so far. Still looking for the next big thing." },
];

const INITIAL_COMMENTS: Comment[] = [
  { id: 1, author: "Sarah Mitchell", authorInitials: "SM", authorColor: "#E91E63", text: "SO excited for the reunion! Has anyone booked a hotel room yet? I heard the Riverside Inn fills up fast.", timestamp: "2 hours ago", likes: 7 },
  { id: 2, author: "Marcus Johnson", authorInitials: "MJ", authorColor: "#FF5722", text: "Already booked — got the last king room at Riverside. Pro tip: book NOW. Also, who's doing the slideshow this year?", timestamp: "1 hour ago", likes: 4 },
  { id: 3, author: "Emma Cho", authorInitials: "EC", authorColor: "#9C27B0", text: "I can do the slideshow! Send me your best \"then vs now\" photos. The more embarrassing the better 😂", timestamp: "45 min ago", likes: 11 },
  { id: 4, author: "Priya Patel", authorInitials: "PP", authorColor: "#009688", text: "Sending all my awkward braces photos immediately. This is going to be amazing. 20 years goes by fast!", timestamp: "30 min ago", likes: 5 },
  { id: 5, author: "Tyler Brooks", authorInitials: "TB", authorColor: "#4CAF50", text: "Does anyone remember Mr. Henderson's chemistry lab incident? We should definitely recreate that moment for the slideshow.", timestamp: "15 min ago", likes: 9 },
];

const STATS = [
  { label: "Alumni Registered", value: "127", icon: "👤", sub: "+12 this week" },
  { label: "Years Since Graduation", value: "20", icon: "🎓", sub: "Class of 2004" },
  { label: "States Represented", value: "34", icon: "🏫", sub: "Across the US" },
  { label: "Messages Posted", value: "248", icon: "💬", sub: "Keep it going!" },
];

function Avatar({ initials, color, size = 48 }: { initials: string; color: string; size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, background: color, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    onLogin();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center p-5">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎓</div>
          <h1 className="text-3xl font-bold text-[#4CAF50] mb-1">ReunionConnect</h1>
          <p className="text-[#666666] text-sm">Westbrook High School — Class of 2004</p>
        </div>

        <div className="bg-white rounded-lg p-10 shadow-[0_1px_3px_rgba(0,0,0,0.1)] border border-[#E0E0E0]">
          <h2 className="text-2xl font-bold text-[#333333] mb-6">Welcome Back</h2>

          {error && (
            <div className="bg-[#FFEBEE] text-[#C62828] border border-[#ef5350] rounded px-3 py-3 text-sm mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#333333] mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-[#DDDDDD] rounded px-3 py-[10px] text-sm focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
              />
            </div>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-[#333333] mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-[#DDDDDD] rounded px-3 py-[10px] text-sm focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-[#4CAF50] text-white font-bold py-[10px] rounded text-sm hover:opacity-90 transition-opacity"
            >
              Sign In
            </button>
          </form>

          <div className="mt-5 text-center">
            <button className="text-[#2196F3] text-xs font-bold hover:opacity-80 transition-opacity">
              Forgot your password?
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-[#EEEEEE] text-center">
            <p className="text-xs text-[#999999]">
              Not registered yet?{" "}
              <button className="text-[#2196F3] font-bold hover:opacity-80 transition-opacity">
                Request access
              </button>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-[#999999] mt-5">
          🔐 Secure access for alumni only
        </p>
      </div>
    </div>
  );
}

function Header({ view, setView, onLogout }: { view: View; setView: (v: View) => void; onLogout: () => void }) {
  const navItems: { label: string; icon: string; view: View }[] = [
    { label: "Home", icon: "🎓", view: "dashboard" },
    { label: "Directory", icon: "📖", view: "directory" },
    { label: "Message Board", icon: "💬", view: "comments" },
  ];

  return (
    <header className="sticky top-0 z-[100] bg-white border-b-2 border-[#4CAF50] shadow-[0_2px_4px_rgba(0,0,0,0.1)] h-[60px] flex items-center px-5">
      <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
        <button
          onClick={() => setView("dashboard")}
          className="text-xl font-bold text-[#4CAF50] hover:opacity-80 transition-opacity flex items-center gap-2"
        >
          🎓 ReunionConnect
        </button>

        <nav className="hidden md:flex items-center gap-[30px]">
          {navItems.map(item => (
            <button
              key={item.view}
              onClick={() => setView(item.view)}
              className={`text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
                view === item.view ? "text-[#4CAF50] font-semibold" : "text-[#333333] hover:text-[#4CAF50]"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("profile")}
            className={`flex items-center gap-2 text-sm font-medium transition-colors duration-200 ${
              view === "profile" ? "text-[#4CAF50]" : "text-[#333333] hover:text-[#4CAF50]"
            }`}
          >
            <Avatar initials="YO" color="#4CAF50" size={32} />
            <span className="hidden sm:inline">My Profile</span>
          </button>
          <button
            onClick={onLogout}
            className="text-xs text-[#999999] hover:text-[#f44336] transition-colors duration-200 font-medium ml-2"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function Dashboard({ setView, setSelectedUser }: { setView: (v: View) => void; setSelectedUser: (u: Alumni) => void }) {
  const recent = ALUMNI.slice(0, 6);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      {/* Welcome banner */}
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-8 mb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-[32px] font-bold text-[#333333] leading-tight mb-2">
              Welcome to the 20-Year Reunion! 🎉
            </h1>
            <p className="text-[#555555] text-base leading-relaxed max-w-2xl">
              Can you believe it has been two decades? Reconnect with your classmates, share memories,
              and get ready for the big event — <strong>August 15–17, 2024</strong> at Westbrook High School.
            </p>
          </div>
          <div className="bg-[#E8F5E9] border border-[#4CAF50] rounded-lg px-5 py-4 text-center flex-shrink-0">
            <div className="text-2xl font-bold text-[#4CAF50]">57</div>
            <div className="text-xs text-[#2E7D32] font-semibold mt-0.5">Days Until Reunion</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-8">
        {STATS.map(stat => (
          <div key={stat.label} className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-shadow duration-200">
            <div className="text-3xl mb-2">{stat.icon}</div>
            <div className="text-2xl font-bold text-[#4CAF50]">{stat.value}</div>
            <div className="text-xs font-semibold text-[#333333] mt-1">{stat.label}</div>
            <div className="text-xs text-[#999999] mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {/* Recently joined */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-[#333333]">Recently Joined</h2>
            <button
              onClick={() => setView("directory")}
              className="text-[#2196F3] text-xs font-bold hover:opacity-80 transition-opacity"
            >
              View all →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recent.map(alumni => (
              <button
                key={alumni.id}
                onClick={() => { setSelectedUser(alumni); setView("profile"); }}
                className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-4 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-200 cursor-pointer"
              >
                <div className="flex justify-center mb-3">
                  <Avatar initials={alumni.initials} color={alumni.color} size={48} />
                </div>
                <div className="text-sm font-semibold text-[#333333] leading-tight">{alumni.name}</div>
                <div className="text-xs text-[#999999] mt-1">{alumni.location}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick info panel */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-[#333333] mb-4">Event Details</h2>
            <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 space-y-3">
              {[
                { icon: "📅", label: "Date", val: "Aug 15–17, 2024" },
                { icon: "📍", label: "Location", val: "Westbrook High School" },
                { icon: "🍽️", label: "Dinner", val: "Sat, Aug 16 at 7pm" },
                { icon: "🏫", label: "Campus Tour", val: "Fri, Aug 15 at 2pm" },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3 pb-3 border-b border-[#EEEEEE] last:border-0 last:pb-0">
                  <span className="text-base">{item.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-[#999999]">{item.label}</div>
                    <div className="text-sm text-[#333333] font-medium">{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold text-[#333333] mb-3">Quick Links</h2>
            <div className="space-y-2">
              <button className="w-full bg-[#4CAF50] text-white font-bold py-[10px] px-5 rounded text-sm hover:opacity-90 transition-opacity text-left flex items-center gap-2">
                <span>📸</span> Submit Your Photos
              </button>
              <button
                onClick={() => setView("directory")}
                className="w-full bg-[#2196F3] text-white font-bold py-[10px] px-5 rounded text-sm hover:opacity-90 transition-opacity text-left flex items-center gap-2"
              >
                <span>📖</span> Browse Directory
              </button>
              <button
                onClick={() => setView("comments")}
                className="w-full border border-[#DDDDDD] text-[#333333] font-bold py-[10px] px-5 rounded text-sm hover:bg-[#F9F9F9] transition-colors text-left flex items-center gap-2"
              >
                <span>💬</span> Message Board
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Directory({ setView, setSelectedUser }: { setView: (v: View) => void; setSelectedUser: (u: Alumni) => void }) {
  const [search, setSearch] = useState("");

  const filtered = ALUMNI.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.location.toLowerCase().includes(search.toLowerCase()) ||
    a.job.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-[32px] font-bold text-[#333333]">Alumni Directory</h1>
          <p className="text-[#555555] text-sm mt-1">{ALUMNI.length} classmates registered</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, city, or job..."
          className="border border-[#DDDDDD] rounded px-3 py-[10px] text-sm w-72 focus:outline-none focus:border-[#4CAF50] placeholder:text-[#999999]"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-[#E0E0E0] p-10 text-center text-[#999999] text-sm">
          No classmates found matching "{search}"
        </div>
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
          {filtered.map(alumni => (
            <button
              key={alumni.id}
              onClick={() => { setSelectedUser(alumni); setView("profile"); }}
              className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 text-center hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] hover:scale-[1.02] transition-all duration-200 cursor-pointer min-h-[200px] flex flex-col items-center justify-center gap-3"
            >
              <Avatar initials={alumni.initials} color={alumni.color} size={64} />
              <div>
                <div className="text-sm font-semibold text-[#333333] leading-tight">{alumni.name}</div>
                <div className="text-xs text-[#666666] mt-1">{alumni.job}</div>
                <div className="text-xs text-[#999999] mt-0.5">{alumni.location}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ProfileView({ alumni, onBack, isOwn = false }: { alumni: Alumni; onBack: () => void; isOwn?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(alumni.bio);

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <button
        onClick={onBack}
        className="text-[#2196F3] text-sm font-bold hover:opacity-80 transition-opacity flex items-center gap-1 mb-6"
      >
        ← Back
      </button>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left: profile card */}
        <div>
          <div className="bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6 text-center">
            <div className="flex justify-center mb-4">
              <Avatar initials={alumni.initials} color={alumni.color} size={96} />
            </div>
            <h2 className="text-2xl font-bold text-[#333333]">{alumni.name}</h2>
            <p className="text-sm text-[#666666] mt-1">{alumni.job} @ {alumni.company}</p>
            <p className="text-sm text-[#999999] mt-0.5">📍 {alumni.location}</p>

            <div className="mt-5 space-y-2">
              <button className="w-full bg-[#4CAF50] text-white font-bold py-[10px] rounded text-sm hover:opacity-90 transition-opacity">
                📧 Send Message
              </button>
              {isOwn && (
                <button
                  onClick={() => setEditing(!editing)}
                  className="w-full bg-[#2196F3] text-white font-bold py-[10px] rounded text-sm hover:opacity-90 transition-opacity"
                >
                  ✏️ {editing ? "Cancel Editing" : "Edit Profile"}
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] mt-4 overflow-hidden">
            <div className="px-5 py-3 border-b border-[#EEEEEE]">
              <h3 className="text-base font-bold text-[#333333]">Contact Info</h3>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <div className="text-xs font-semibold text-[#999999]">Email</div>
                <div className="text-sm text-[#2196F3]">{alumni.email}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#999999]">Class Year</div>
                <div className="text-sm text-[#333333]">{alumni.gradYear}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#999999]">Company</div>
                <div className="text-sm text-[#333333]">{alumni.company}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: bio + photos */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-4">About</h3>
            {editing ? (
              <div>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full border border-[#DDDDDD] rounded px-3 py-3 text-sm focus:outline-none focus:border-[#4CAF50] resize-vertical min-h-[100px]"
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => setEditing(false)}
                    className="bg-[#4CAF50] text-white font-bold py-[10px] px-5 rounded text-sm hover:opacity-90 transition-opacity"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => { setBio(alumni.bio); setEditing(false); }}
                    className="border border-[#DDDDDD] text-[#555555] font-bold py-[10px] px-5 rounded text-sm hover:bg-[#F9F9F9] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[#555555] text-sm leading-relaxed">{bio}</p>
            )}
          </div>

          {/* Then & Now photos */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-4">📸 Then &amp; Now</h3>
            <div className="grid grid-cols-2 gap-4">
              {["Then (2004)", "Now (2024)"].map((label) => (
                <div key={label}>
                  <div
                    className="rounded-lg flex items-center justify-center text-[#999999] text-sm border-2 border-dashed border-[#DDDDDD] bg-[#F9F9F9] cursor-pointer hover:border-[#4CAF50] hover:bg-[#E8F5E9] transition-colors duration-200"
                    style={{ height: 180 }}
                  >
                    <div className="text-center">
                      <div className="text-3xl mb-2">📷</div>
                      <div className="text-xs font-semibold">Add photo</div>
                    </div>
                  </div>
                  <div className="text-xs text-center text-[#666666] mt-2 font-semibold">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-6">
            <h3 className="text-lg font-bold text-[#333333] mb-4">Life Timeline</h3>
            <div className="space-y-0">
              {[
                { year: "2004", event: `Graduated from Westbrook High School 🎓` },
                { year: "2008", event: `Completed undergraduate studies` },
                { year: "2012", event: `Started career at ${alumni.company}` },
                { year: "2024", event: `${alumni.job} at ${alumni.company}` },
              ].map((item, i, arr) => (
                <div key={item.year} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-[#4CAF50] flex-shrink-0 mt-1" />
                    {i < arr.length - 1 && <div className="w-0.5 bg-[#E0E0E0] flex-1 my-1" />}
                  </div>
                  <div className={`pb-5 ${i === arr.length - 1 ? "pb-0" : ""}`}>
                    <div className="text-xs font-bold text-[#4CAF50]">{item.year}</div>
                    <div className="text-sm text-[#555555]">{item.event}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBoard() {
  const [comments, setComments] = useState<Comment[]>(INITIAL_COMMENTS);
  const [newComment, setNewComment] = useState("");
  const [success, setSuccess] = useState(false);

  const handlePost = () => {
    if (!newComment.trim()) return;
    const comment: Comment = {
      id: comments.length + 1,
      author: "You",
      authorInitials: "YO",
      authorColor: "#4CAF50",
      text: newComment.trim(),
      timestamp: "just now",
      likes: 0,
    };
    setComments([...comments, comment]);
    setNewComment("");
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleLike = (id: number) => {
    setComments(comments.map(c => c.id === id ? { ...c, likes: c.likes + 1 } : c));
  };

  return (
    <div className="max-w-[1200px] mx-auto px-5 py-8">
      <h1 className="text-[32px] font-bold text-[#333333] mb-2">Message Board 💬</h1>
      <p className="text-[#555555] text-sm mb-6">Share your excitement, memories, and reunion plans with your classmates.</p>

      {success && (
        <div className="bg-[#E8F5E9] text-[#2E7D32] border border-[#4CAF50] rounded px-4 py-3 text-sm mb-5 flex items-center gap-2">
          ✅ Your message was posted!
        </div>
      )}

      {/* New comment */}
      <div className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 mb-6">
        <div className="flex gap-3">
          <Avatar initials="YO" color="#4CAF50" size={40} />
          <div className="flex-1">
            <textarea
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Share a memory, a question, or some excitement..."
              className="w-full border border-[#DDDDDD] rounded px-3 py-3 text-sm focus:outline-none focus:border-[#4CAF50] resize-none min-h-[80px] placeholder:text-[#999999]"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={handlePost}
                disabled={!newComment.trim()}
                className="bg-[#4CAF50] text-white font-bold py-[10px] px-5 rounded text-sm hover:opacity-90 transition-opacity disabled:bg-[#CCCCCC] disabled:cursor-not-allowed"
              >
                Post Message
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment list */}
      <div className="space-y-4">
        {[...comments].reverse().map(comment => (
          <div key={comment.id} className="bg-white rounded-lg border border-[#E0E0E0] shadow-[0_1px_3px_rgba(0,0,0,0.1)] p-5 hover:shadow-[0_2px_4px_rgba(0,0,0,0.1)] transition-shadow duration-200">
            <div className="flex gap-3">
              <Avatar initials={comment.authorInitials} color={comment.authorColor} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-semibold text-[#333333]">{comment.author}</span>
                  <span className="text-xs text-[#999999] italic">{comment.timestamp}</span>
                </div>
                <p className="text-sm text-[#555555] mt-2 leading-relaxed">{comment.text}</p>
                <div className="flex items-center gap-4 mt-3">
                  <button
                    onClick={() => handleLike(comment.id)}
                    className="text-xs text-[#666666] hover:text-[#4CAF50] transition-colors duration-200 font-medium flex items-center gap-1"
                  >
                    👍 {comment.likes > 0 ? comment.likes : ""} Like
                  </button>
                  <button className="text-xs text-[#666666] hover:text-[#2196F3] transition-colors duration-200 font-medium">
                    💬 Reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [view, setView] = useState<View>("dashboard");
  const [selectedUser, setSelectedUser] = useState<Alumni | null>(null);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} />;
  }

  const handleSetView = (v: View) => {
    if (v !== "profile") setSelectedUser(null);
    setView(v);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <Header view={view} setView={handleSetView} onLogout={() => setLoggedIn(false)} />

      <main>
        {view === "dashboard" && (
          <Dashboard setView={handleSetView} setSelectedUser={setSelectedUser} />
        )}
        {view === "directory" && (
          <Directory setView={handleSetView} setSelectedUser={setSelectedUser} />
        )}
        {view === "profile" && selectedUser && (
          <ProfileView
            alumni={selectedUser}
            onBack={() => handleSetView("directory")}
          />
        )}
        {view === "profile" && !selectedUser && (
          <ProfileView
            alumni={{ id: 0, name: "Your Name", gradYear: 2004, location: "Your City, ST", job: "Your Job Title", company: "Your Company", email: "you@email.com", color: "#4CAF50", initials: "YO", bio: "Tell your classmates what you've been up to for the past 20 years!" }}
            onBack={() => handleSetView("dashboard")}
            isOwn
          />
        )}
        {view === "comments" && <MessageBoard />}
      </main>
    </div>
  );
}
