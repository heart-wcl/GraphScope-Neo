/**
 * useModal Hook - DDD 架构表现层
 * 统一管理 Modal 的显示/隐藏状态
 * 
 * 解决问题：组件中重复的 modal 状态管理代码
 */

import { useState, useCallback, useEffect } from 'react';

/**
 * Modal 状态
 */
interface ModalState<T = void> {
  isOpen: boolean;
  data: T | null;
}

/**
 * Modal Hook 返回值
 */
export interface UseModalResult<T = void> {
  /** Modal 是否打开 */
  isOpen: boolean;
  /** Modal 关联的数据 */
  data: T | null;
  /** 打开 Modal */
  open: (data?: T) => void;
  /** 关闭 Modal */
  close: () => void;
  /** 切换 Modal 状态 */
  toggle: () => void;
  /** 设置 Modal 数据（不改变打开状态） */
  setData: (data: T | null) => void;
}

/**
 * Modal 配置
 */
export interface UseModalOptions<T = void> {
  /** 初始是否打开 */
  initialOpen?: boolean;
  /** 初始数据 */
  initialData?: T | null;
  /** 关闭时回调 */
  onClose?: () => void;
  /** 打开时回调 */
  onOpen?: (data?: T) => void;
  /** 按 ESC 键关闭 */
  closeOnEscape?: boolean;
}

/**
 * Modal 管理 Hook
 * 
 * @example
 * ```tsx
 * // 基础用法
 * const modal = useModal();
 * 
 * return (
 *   <>
 *     <button onClick={() => modal.open()}>Open Modal</button>
 *     {modal.isOpen && (
 *       <Modal onClose={modal.close}>
 *         <p>Modal Content</p>
 *       </Modal>
 *     )}
 *   </>
 * );
 * 
 * // 带数据的用法
 * const editModal = useModal<User>();
 * 
 * const handleEdit = (user: User) => {
 *   editModal.open(user);
 * };
 * 
 * return (
 *   <>
 *     {users.map(user => (
 *       <button key={user.id} onClick={() => handleEdit(user)}>
 *         Edit {user.name}
 *       </button>
 *     ))}
 *     {editModal.isOpen && editModal.data && (
 *       <EditUserModal user={editModal.data} onClose={editModal.close} />
 *     )}
 *   </>
 * );
 * ```
 */
export function useModal<T = void>(options: UseModalOptions<T> = {}): UseModalResult<T> {
  const {
    initialOpen = false,
    initialData = null,
    onClose,
    onOpen,
    closeOnEscape = true
  } = options;

  const [state, setState] = useState<ModalState<T>>({
    isOpen: initialOpen,
    data: initialData
  });

  const open = useCallback((data?: T) => {
    setState({ isOpen: true, data: data ?? null });
    onOpen?.(data);
  }, [onOpen]);

  const close = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
    onClose?.();
  }, [onClose]);

  const toggle = useCallback(() => {
    setState(prev => {
      const newIsOpen = !prev.isOpen;
      if (newIsOpen) {
        onOpen?.();
      } else {
        onClose?.();
      }
      return { ...prev, isOpen: newIsOpen };
    });
  }, [onOpen, onClose]);

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data }));
  }, []);

  // ESC 键关闭
  useEffect(() => {
    if (!closeOnEscape || !state.isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [closeOnEscape, state.isOpen, close]);

  return {
    isOpen: state.isOpen,
    data: state.data,
    open,
    close,
    toggle,
    setData
  };
}

/**
 * 确认对话框 Hook
 * 
 * @example
 * ```tsx
 * const confirm = useConfirmModal({
 *   onConfirm: async () => {
 *     await deleteItem(itemId);
 *   }
 * });
 * 
 * return (
 *   <>
 *     <button onClick={() => confirm.show('确定要删除吗？')}>Delete</button>
 *     {confirm.isOpen && (
 *       <ConfirmDialog
 *         message={confirm.message}
 *         loading={confirm.loading}
 *         onConfirm={confirm.confirm}
 *         onCancel={confirm.cancel}
 *       />
 *     )}
 *   </>
 * );
 * ```
 */
export interface UseConfirmModalResult {
  isOpen: boolean;
  message: string;
  loading: boolean;
  show: (message: string) => void;
  confirm: () => Promise<void>;
  cancel: () => void;
}

export interface UseConfirmModalOptions {
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
}

export function useConfirmModal(options: UseConfirmModalOptions): UseConfirmModalResult {
  const { onConfirm, onCancel } = options;

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const show = useCallback((msg: string) => {
    setMessage(msg);
    setIsOpen(true);
  }, []);

  const confirm = useCallback(async () => {
    setLoading(true);
    try {
      await onConfirm();
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, [onConfirm]);

  const cancel = useCallback(() => {
    setIsOpen(false);
    onCancel?.();
  }, [onCancel]);

  return {
    isOpen,
    message,
    loading,
    show,
    confirm,
    cancel
  };
}

export default useModal;
