import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';

const overlayStyle = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(44,48,37,0.5)',
  backdropFilter: 'blur(4px)', zIndex: 200,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
};

export default function ConfirmModal({ title, message, confirmLabel, cancelLabel, danger = false, onConfirm, onCancel }) {
  const { t } = useLanguage();
  const resolvedConfirm = confirmLabel ?? t('common.confirm');
  const resolvedCancel = cancelLabel ?? t('common.cancel');
  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onCancel()}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        style={{ width: '100%', maxWidth: '340px', background: '#F2EDE4', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#2C3025', margin: '0 0 6px' }}>{title}</h2>
          {message && <p style={{ fontSize: '13px', color: '#6b5c45', lineHeight: '1.6', margin: 0 }}>{message}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onCancel}
            style={{ padding: '8px 16px', background: 'rgba(200,184,154,0.25)', color: '#6b5c45', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {resolvedCancel}
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }} onClick={onConfirm}
            style={{ padding: '8px 16px', background: danger ? '#a03030' : '#2C3025', color: '#E8E4DC', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            {resolvedConfirm}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
