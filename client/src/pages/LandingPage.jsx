import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Users, Trophy, ArrowRight, Zap } from 'lucide-react';

const features = [
  {
    icon: <Camera className="w-7 h-7 text-brand-pink" />,
    title: 'Daily Target',
    desc: 'Each day at midnight, one squad member is randomly selected as the target. Fairness lock ensures everyone gets their turn.',
    badge: '12:00 AM',
    color: 'from-pink-500/20 to-rose-500/10',
  },
  {
    icon: <Zap className="w-7 h-7 text-brand-amber" />,
    title: 'Create Sticker',
    desc: 'Hunt the target all day. Snap a candid photo, crop it into a sticker cutout, and upload it before 10 PM.',
    badge: 'BEFORE 10 PM',
    color: 'from-amber-500/20 to-yellow-500/10',
  },
  {
    icon: <Trophy className="w-7 h-7 text-brand-green" />,
    title: 'Vote at 10 PM',
    desc: 'The arena opens! Rank your top 3 favorite stickers. 1st=5pts, 2nd=3pts, 3rd=1pt. The best candid wins.',
    badge: '10:00 PM',
    color: 'from-green-500/20 to-emerald-500/10',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-dark text-white overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 relative z-10">
        <div className="flex items-center gap-2 text-xl font-bold">
          <span>🎭</span>
          <span className="text-white">Stickerly</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/login')}
            className="px-5 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/register')}
            className="px-5 py-2 text-sm font-semibold bg-brand-pink rounded-full hover:bg-pink-600 transition-colors"
          >
            Sign up
          </button>
        </div>
      </nav>

      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-pink/20 rounded-full blur-3xl" />
        <div className="absolute top-20 right-10 w-80 h-80 bg-brand-blue/15 rounded-full blur-3xl" />
        <div className="absolute bottom-40 left-1/2 w-72 h-72 bg-brand-amber/10 rounded-full blur-3xl" />
      </div>

      {/* Hero */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-28">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-300 mb-8"
        >
          <span className="w-2 h-2 bg-brand-green rounded-full animate-pulse" />
          Now in early access — invite your squad
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-6xl md:text-8xl font-extrabold mb-6 leading-tight"
        >
          <span
            className="bg-gradient-to-r from-brand-pink via-purple-400 to-brand-blue bg-clip-text text-transparent animate-gradient"
            style={{ backgroundSize: '200% 200%' }}
          >
            Stickerly
          </span>{' '}
          <span>🎭</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-xl md:text-2xl text-gray-300 max-w-2xl mb-10 leading-relaxed"
        >
          The candid sticker game for friend groups.
          <br />
          <span className="text-gray-400">Hunt. Snap. Vote. Win.</span>
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <button
            onClick={() => navigate('/register')}
            className="flex items-center gap-2 px-8 py-4 bg-brand-pink text-white font-semibold rounded-2xl hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/30 hover:shadow-pink-500/50 hover:-translate-y-0.5 active:translate-y-0 text-base"
          >
            Create a Room <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate('/login')}
            className="flex items-center gap-2 px-8 py-4 bg-white/10 backdrop-blur border border-white/20 text-white font-semibold rounded-2xl hover:bg-white/20 transition-all text-base"
          >
            <Users className="w-4 h-4" /> Join a Room
          </button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex items-center gap-3 mt-10 text-sm text-gray-400"
        >
          <div className="flex -space-x-2">
            {['#E84393', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6'].map((c, i) => (
              <div
                key={i}
                className="w-8 h-8 rounded-full border-2 border-brand-dark flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: c }}
              >
                {String.fromCharCode(65 + i)}
              </div>
            ))}
          </div>
          <span>Join 500+ squads playing today</span>
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-3">How it works</p>
          <h2 className="text-3xl md:text-4xl font-bold">Three steps, infinite drama</h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 32 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`relative p-6 rounded-2xl bg-gradient-to-br ${f.color} border border-white/10 backdrop-blur hover:border-white/20 transition-all group`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-2.5 bg-white/10 rounded-xl">{f.icon}</div>
                <span className="text-xs font-mono font-bold text-gray-400 bg-white/10 px-2 py-1 rounded-full">
                  {f.badge}
                </span>
              </div>
              <h3 className="text-lg font-bold mb-2">{f.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              <div className="absolute top-4 right-4 text-2xl opacity-10 group-hover:opacity-20 transition-opacity">
                {i === 0 ? '🎯' : i === 1 ? '📸' : '🏆'}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA bottom */}
      <section className="relative z-10 text-center pb-24 px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto bg-gradient-to-br from-brand-pink/20 to-brand-blue/20 border border-white/10 rounded-3xl p-10"
        >
          <div className="text-4xl mb-4">🎭</div>
          <h2 className="text-2xl font-bold mb-3">Ready to get caught?</h2>
          <p className="text-gray-400 mb-6 text-sm">Create a room, invite your group, and let the candid chaos begin.</p>
          <button
            onClick={() => navigate('/register')}
            className="px-8 py-3.5 bg-brand-pink text-white font-semibold rounded-xl hover:bg-pink-600 transition-all shadow-lg shadow-pink-500/30"
          >
            Start Playing Free →
          </button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-8 text-xs text-gray-600">
        © 2024 Stickerly · Made for friend groups
      </footer>
    </div>
  );
}
