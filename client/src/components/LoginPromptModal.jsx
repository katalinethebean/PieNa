import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

// 访客点击需要登录的功能时弹出的提示框
export default function LoginPromptModal({ onClose }) {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(44,48,37,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="glass-card"
        style={{ width: '100%', maxWidth: '360px', padding: '36px 28px', textAlign: 'center', background: 'rgba(248,244,238,0.97)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: '32px', marginBottom: '14px' }}>👋</div>
        <p style={{ fontSize: '17px', fontWeight: 700, color: '#2C3025', marginBottom: '8px' }}>登录后解锁完整功能</p>
        <p style={{ fontSize: '13px', color: '#7d6b55', lineHeight: 1.7, marginBottom: '24px' }}>
          注册撇捺账号，即可联系发帖人、发布招募、记录并复盘你的比赛
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/login')}
          style={{ width: '100%', padding: '12px', background: '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.04em', marginBottom: '10px' }}
        >
          登录 / 注册
        </motion.button>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: '12px', color: '#9a8570', cursor: 'pointer', fontFamily: 'inherit', padding: '6px' }}
        >
          先随便逛逛
        </button>
      </motion.div>
    </motion.div>
  );
}
