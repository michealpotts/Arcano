import { useState, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { profileAPI } from "../../services/authAPI";

/* ------------------------------------------------------
   DASHBOARD PANEL — ARCANO AAA VERSION
------------------------------------------------------- */

export default function DashboardPanel() {
  const { user: authUser, login } = useAuth();

  // TEMP USER DATA merged with authenticated user data
  const user = {
    username: authUser?.nickName || "Player",
    playerId: authUser?.playerId,
    level: authUser?.level ?? 0,
    xp: authUser?.xp ?? 0,
    xpToNext: 6000,
    streak: 4,
    galaBalance: authUser?.galaBalance || "0.00000000",
    eggs: 4,
    creatures: 3,
    legendaryCreatures: 1,
    hatchCount: 12,
    incubators: { used: 2, total: 4 },
    evolutions: 7,
    marketProfit: 280,
    totalXP: 18250,
  };

  const xpPercent = Math.min(100, Math.floor((user.xp / user.xpToNext) * 100));

  const [uploading, setUploading] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [uploadError, setUploadError] = useState(null);
  const [nameError, setNameError] = useState(null);
  const fileInputRef = useRef(null);

  // Daily missions temporary
  const [missions, setMissions] = useState([
    { id: 1, text: "Hatch 1 egg", progress: 0, goal: 1, reward: 50, done: false },
    { id: 2, text: "Visit Creatures page", progress: 1, goal: 1, reward: 10, done: true },
    { id: 3, text: "Check Incubator", progress: 0, goal: 1, reward: 5, done: false },
  ]);

  const completeMission = (id) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, done: true, progress: m.goal } : m
      )
    );
  };

  // Fake notifications feed
  const notifications = [
    { id: 1, text: "Your Frost Egg finished hatching!" },
    { id: 2, text: "You earned an achievement: Daily Ritualist." },
    { id: 3, text: "Your item sold on marketplace for 42 ARCANO." },
  ];

  // Upload handlers
  const handleAvatarClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user.playerId) {
      setUploadError("Player ID not found");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      // Backend expects field named 'profilePicture'
      form.append("profilePicture", file);
      const updated = await profileAPI.uploadProfilePicture(user.playerId, form);
      
      if (updated) {
        // Update AuthContext with new profile data
        login({ profile: updated });
        console.log("Profile picture uploaded successfully");
      } else {
        setUploadError("Failed to upload profile picture");
      }
    } catch (err) {
      console.error("Failed to upload profile picture:", err);
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  // Name modal handlers
  const openNameModal = () => {
    setNewName(user.username || "");
    setNameError(null);
    setShowNameModal(true);
  };

  const saveName = async () => {
    if (!user.playerId) {
      setNameError("Player ID not found");
      return;
    }
    if (!newName.trim()) {
      setNameError("Name cannot be empty");
      return;
    }

    try {
      const updated = await profileAPI.updateNickname(user.playerId, newName.trim());
      if (updated) {
        // Update AuthContext with new profile data
        login({ profile: updated });
        setShowNameModal(false);
        console.log("Nickname updated successfully");
      } else {
        setNameError("Failed to update nickname");
      }
    } catch (err) {
      console.error("Failed to update nickname:", err);
      setNameError(err.message || "Update failed");
    }
  };

  return (
    <>
      <div className="space-y-10">

        {/* =====================================================
            USER HEADER
        ===================================================== */}
        <div className="relative rounded-3xl p-6 bg-black/70 border border-white/10 backdrop-blur-xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-800/10 to-purple-500/5 pointer-events-none"></div>

          <div className="relative flex items-center gap-5">
            {/* Avatar */}
            <div className="relative w-16 h-16 rounded-2xl bg-purple-700/40 border border-purple-300/20 flex items-center justify-center overflow-hidden">
              {authUser?.profilePicture ? (
                <img src={authUser.profilePicture} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-4xl">🐉</div>
              )}

              <button
                onClick={handleAvatarClick}
                title="Change profile picture"
                className="absolute inset-0 bg-black/0 hover:bg-black/30 flex items-center justify-center transition-opacity"
                disabled={uploading}
              >
                {uploading ? (
                  <svg className="w-6 h-6 text-white animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25"></circle>
                    <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round"></path>
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold">{user.username}</h1>
                <button onClick={openNameModal} title="Edit name" className="text-white/70 hover:text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path d="M3 21v-3.75L14.06 6.19a2.5 2.5 0 013.54 0l1.21 1.21a2.5 2.5 0 010 3.54L7.76 22H3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              <p className="text-xs text-gray-400">Level {user.level}</p>

              <div className="mt-2 w-full h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${xpPercent}%` }}
                ></div>
              </div>

              <p className="text-[0.7rem] text-gray-500 mt-1">
                {user.xp} / {user.xpToNext} XP
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-purple-300 font-semibold">🔥 Streak: {user.streak}</p>
              <p className="text-sm text-yellow-300 font-semibold">💎 {user.galaBalance} GALA</p>

              <button className="mt-2 px-3 py-1.5 text-xs bg-purple-600/70 hover:bg-purple-700 border border-purple-300 rounded-xl">
                Claim Daily Gift
              </button>
            </div>
          </div>
        </div>

        {/* =====================================================
            STATS
        ===================================================== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Eggs" value={user.eggs} icon="🥚" />
          <StatCard label="Creatures" value={user.creatures} icon="🐾" />
          <StatCard label="Legendaries" value={user.legendaryCreatures} icon="💎" />
          <StatCard label="Hatched" value={user.hatchCount} icon="🐣" />
          <StatCard label="Incubators" value={`${user.incubators.used} / ${user.incubators.total}`} icon="🧪" />
          <StatCard label="Evolutions" value={user.evolutions} icon="🧬" />
          <StatCard label="Profit" value={`${user.marketProfit} ARC`} icon="💰" />
          <StatCard label="Total XP" value={user.totalXP} icon="📈" />
        </div>

        {/* =====================================================
            FEATURED CREATURE
        ===================================================== */}
        <div className="rounded-3xl bg-black/60 border border-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-3 text-white/90">Featured Creature</h2>

          <div className="flex items-center gap-6">
            <div className="w-28 h-28 rounded-2xl bg-purple-700/20 border border-purple-300/20 flex items-center justify-center text-5xl">
              🐲
            </div>

            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Inferno Drake</p>
              <p className="text-xs text-gray-400">Level 8 · Inferno Faction</p>

              <div className="mt-2">
                <button className="px-3 py-1.5 text-xs bg-purple-600/70 border border-purple-300 rounded-xl hover:bg-purple-700 mr-2">
                  View
                </button>
                <button className="px-3 py-1.5 text-xs bg-white/10 border border-white/10 rounded-xl hover:bg-white/20">
                  Evolve
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =====================================================
            DAILY MISSIONS
        ===================================================== */}
        <div className="rounded-3xl bg-black/60 border border-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-3 text-white/90">Daily Missions</h2>

          <div className="space-y-4">
            {missions.map((m) => {
              const percent = Math.min(100, Math.floor((m.progress / m.goal) * 100));

              return (
                <div key={m.id} className="p-4 border border-white/10 rounded-xl bg-black/40">
                  <div className="flex justify-between mb-2">
                    <p className="text-sm text-white">{m.text}</p>
                    <p className="text-xs text-purple-300">{m.reward} XP</p>
                  </div>

                  <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${percent}%` }}
                    ></div>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-400">{m.progress}/{m.goal}</p>

                    {!m.done && (
                      <button
                        onClick={() => completeMission(m.id)}
                        className="px-3 py-1.5 text-xs bg-purple-600/70 border border-purple-300 rounded-xl hover:bg-purple-700"
                      >
                        Claim
                      </button>
                    )}

                    {m.done && (
                      <span className="text-xs text-yellow-300 font-semibold">COMPLETED</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* =====================================================
            QUICK ACTIONS
        ===================================================== */}
        <div className="rounded-3xl bg-black/60 border border-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-4 text-white/90">Quick Actions</h2>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            <QuickAction icon="🥚" label="My Eggs" />
            <QuickAction icon="🧪" label="Incubator" />
            <QuickAction icon="🐾" label="Creatures" />
            <QuickAction icon="🧬" label="Evolution" />
            <QuickAction icon="🛒" label="Shop" />
            <QuickAction icon="🏆" label="Achievements" />
          </div>
        </div>

        {/* =====================================================
            NOTIFICATIONS
        ===================================================== */}
        <div className="rounded-3xl bg-black/60 border border-white/10 p-6 backdrop-blur-xl">
          <h2 className="text-sm font-semibold mb-3 text-white/90">Recent Notifications</h2>

          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="p-3 bg-black/40 rounded-xl border border-white/5 text-xs text-gray-300"
              >
                {n.text}
              </div>
            ))}
          </div>
        </div>

        {/* =====================================================
            EVENT BANNER
        ===================================================== */}
        <div className="rounded-2xl bg-gradient-to-r from-purple-700/40 to-fuchsia-600/30 border border-purple-300/20 p-5 text-center backdrop-blur-xl hover:brightness-110 transition-all cursor-pointer">
          <p className="text-sm text-white font-semibold">❄️ Frostborn Event — 2× Hatch Chance This Week!</p>
          <p className="text-xs text-purple-200 mt-1">Tap to view event details</p>
        </div>
      </div>

      {/* =====================================================
          NAME EDIT MODAL
      ===================================================== */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md bg-black/80 border border-white/10 rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-3">Edit Profile Name</h3>
            <input
              className="w-full mb-4 px-3 py-2 rounded bg-white/5 border border-white/10"
              placeholder={user.username}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            {nameError && <p className="text-red-400 text-xs mb-2">{nameError}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowNameModal(false)} className="px-3 py-2 rounded bg-white/5 hover:bg-white/10">
                Cancel
              </button>
              <button onClick={saveName} className="px-3 py-2 rounded bg-purple-600 text-white hover:bg-purple-700">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------
   SUB-COMPONENTS
------------------------------------------------------- */

function StatCard({ label, value, icon }) {
  return (
    <div className="p-4 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-xl flex flex-col items-start">
      <p className="text-2xl mb-1">{icon}</p>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}

function QuickAction({ icon, label }) {
  return (
    <button className="flex flex-col items-center justify-center p-4 bg-black/40 border border-white/10 rounded-2xl hover:bg-white/5 transition">
      <span className="text-2xl">{icon}</span>
      <span className="text-[0.7rem] mt-1 text-gray-300">{label}</span>
    </button>
  );
}
