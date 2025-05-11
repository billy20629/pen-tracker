import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';

const TabletPenTracker = () => {
  // ─── State 定義 ─────────────────────
  const [stage, setStage] = useState('selectMode');
  // selectMode / login / adminLogin / borrow / return / admin / overdue
  const [action, setAction] = useState('');
  const [user, setUser] = useState(null);
  const [pens, setPens] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  // Firebase Auth & Provider
  const auth     = getAuth();
  const provider = new GoogleAuthProvider();
  const meEmail  = user?.email ?? '';

  // 是否進入真正的管理者模式（帳密登入過）
  const isManager = stage === 'admin';

  // ─── Helper 函式 ───────────────────
  const formatDate = date =>
    date
      ? `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(
          date.getDate()
        ).padStart(2, '0')}`
      : '';
  const remainingDays = end =>
    end ? Math.ceil((new Date(end) - new Date()) / (1000 * 60 * 60 * 24)) : null;

  // ─── 1. 監聽 Auth 狀態 ────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
      // 若在借用/歸還階段、卻沒有登入，就導回登入畫面
      if (!u && (stage === 'borrow' || stage === 'return')) {
        setStage('login');
      }
    });
    return () => unsub();
  }, [stage]);

  // ─── 2. Firestore 實時監聽 ───────────
  useEffect(() => {
    // 只要還沒到借用/歸還/admin/逾期階段，都不用拿資料
    if (
      stage === 'selectMode' ||
      stage === 'login' ||
      stage === 'adminLogin'
    ) return;

    const pensRef = collection(db, 'pens');
    const unsub = onSnapshot(pensRef, snap => {
      if (snap.empty) {
        // 首次初始化 1~92 支筆，加上 repairing & overdue 欄位
        (async () => {
          const tmp = [];
          for (let i = 1; i <= 92; i++) {
            await setDoc(doc(db, 'pens', `${i}`), {
              borrower: null,
              startDate: null,
              endDate: null,
              repairing: false,
              overdue: false
            });
            tmp.push({
              id: i,
              borrower: null,
              startDate: null,
              endDate: null,
              repairing: false,
              overdue: false
            });
          }
          setPens(tmp);
        })();
      } else {
        const arr = snap.docs.map(d => {
          const dt = d.data();
          return {
            id: +d.id,
            borrower: dt.borrower,
            startDate: dt.startDate?.toDate() || null,
            endDate: dt.endDate?.toDate() || null,
            repairing: dt.repairing || false,
            overdue: dt.overdue || false
          };
        });
        arr.sort((a, b) => a.id - b.id);
        setPens(arr);
      }
      setSelectedIds([]);
    });
    return () => unsub();
  }, [stage]);

  // ─── 3. 切換模式 ──────────────────────
  const chooseMode = m => {
    setAction(m);
    if (m === 'admin') {
      setStage('adminLogin');
    } else {
      setStage('login');
    }
  };

  // ─── 4. Google 登入（借用/歸還） ───────
  const doGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, provider);
      if (action === 'borrow') setStage('borrow');
      else if (action === 'return') setStage('return');
    } catch (e) {
      console.error(e);
    }
  };

  // ─── 5. 管理者帳號密碼登入 ─────────────
  const doAdminLogin = () => {
    if (adminUser === 'admin' && adminPass === 'admin') {
      setStage('admin');
    } else {
      alert('管理者帳號或密碼錯誤');
      setStage('selectMode');
    }
  };

  // ─── 6. 登出（含 Google） ─────────────
  const doLogout = async () => {
    await signOut(auth);
    setStage('selectMode');
    setAction('');
    setAdminUser('');
    setAdminPass('');
  };

  // ─── 7. 準備可視筆格 ──────────────────
  let visible = [];
  if (stage === 'borrow') visible = pens;
  else if (stage === 'return') visible = pens.filter(p => p.borrower === meEmail);
  else if (stage === 'admin') visible = pens;
  else visible = [];

  const allIds = visible.map(p => p.id);
  const toggleAll = () =>
    setSelectedIds(prev =>
      prev.length === allIds.length ? [] : [...allIds]
    );
  const toggleOne = id =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  // ─── 8. 借用/歸還/報修/解除報修/手動逾期 ────
  const doBorrow = async () => {
    if (!selectedIds.length || !startDate || !endDate) {
      alert('請勾選筆並設置起訖日');
      return;
    }
    const sd = new Date(startDate),
      ed = new Date(endDate);
    if (ed < sd) {
      alert('歸還日需 ≥ 起始日');
      return;
    }
    for (let id of selectedIds) {
      const p = pens.find(x => x.id === id);
      if (!p.borrower && !p.repairing) {
        await updateDoc(doc(db, 'pens', `${id}`), {
          borrower: meEmail,
          startDate: sd,
          endDate: ed
        });
      }
    }
    alert('借用成功！祝您使用順利。');
    setSelectedIds([]);
  };

  const doReturn = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`確定歸還 ${selectedIds.join(', ')}？`)) return;
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), {
        borrower: null,
        startDate: null,
        endDate: null
      });
    }
    alert(`成功歸還：${selectedIds.join(', ')}`);
    setSelectedIds([]);
  };

  const doRepair = async () => {
    if (!selectedIds.length) return;
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), { repairing: true });
    }
    alert(`已標記維修中：${selectedIds.join(', ')}`);
    setSelectedIds([]);
  };

  const doRepairDone = async () => {
    if (!selectedIds.length) return;
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), { repairing: false });
    }
    alert(`已解除報修：${selectedIds.join(', ')}`);
    setSelectedIds([]);
  };

  const doMarkOverdue = async () => {
    if (!selectedIds.length) return;
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), { overdue: true });
    }
    alert(`已標記逾期：${selectedIds.join(', ')}`);
    setSelectedIds([]);
  };

  const doClearOverdue = async () => {
    if (!selectedIds.length) return;
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), { overdue: false });
    }
    alert(`已取消逾期：${selectedIds.join(', ')}`);
    setSelectedIds([]);
  };

  // ─── 9. 逾期清單 ──────────────────────
  const overdueList = pens
    .filter(p => p.borrower && p.endDate < new Date())
    .sort((a, b) => a.endDate - b.endDate);

  // ─── UI ──────────────────────────────

  // a) 主選單
  if (stage === 'selectMode') {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <h1>平板筆借閱系統</h1>
        <button onClick={() => chooseMode('borrow')}>借用模式</button>
        <button onClick={() => chooseMode('return')}>歸還模式</button>
        <button onClick={() => chooseMode('admin')}>管理者模式</button>
      </div>
    );
  }

  // b) 借用/歸還 Google 登入
  if (stage === 'login') {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <h2>請使用 Google 帳號登入</h2>
        <button onClick={doGoogleLogin}>使用 Google 登入</button>
      </div>
    );
  }

  // c) 管理者 帳號/密碼 登入
  if (stage === 'adminLogin') {
    return (
      <div style={{ maxWidth: 300, margin: '40px auto', textAlign: 'center' }}>
        <h2>管理者登入</h2>
        <input
          placeholder="帳號"
          value={adminUser}
          onChange={e => setAdminUser(e.target.value)}
        /><br/><br/>
        <input
          placeholder="密碼"
          type="password"
          value={adminPass}
          onChange={e => setAdminPass(e.target.value)}
        /><br/><br/>
        <button onClick={doAdminLogin}>登入</button>
      </div>
    );
  }

  // d) 借用 / 歸還 / 管理者 / 逾期 未歸 查詢
  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h2>
          {stage === 'borrow'
            ? `借用模式 - ${meEmail}`
            : stage === 'return'
            ? `歸還模式 - ${meEmail}`
            : stage === 'admin'
            ? `管理者模式`
            : '逾期未歸查詢'}
        </h2>
        <button onClick={doLogout}>登出</button>
      </div>

      {/* 借用說明 + 日期選擇 */}
      {(stage === 'borrow' || stage === 'admin') && (
        <div style={{ marginBottom: 10 }}>
          <div>請勾選並選擇起訖日期後點擊「點我按借用」。</div>
          <label>
            起始日:
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </label>
          <label style={{ marginLeft: 20 }}>
            歸還日:
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </label>
        </div>
      )}

      {/* 筆格列表 */}
      {stage !== 'overdue' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))',
            gap: 10
          }}
        >
          <div>
            <input
              type="checkbox"
              checked={selectedIds.length === allIds.length && allIds.length > 0}
              onChange={toggleAll}
            /> 全選
          </div>

          {visible.map(p => {
            const days = p.endDate ? remainingDays(p.endDate) : null;
            const status = p.repairing
              ? '維修中'
              : p.borrower
              ? days <= 2
                ? '短期'
                : '長期'
              : '可借用';
            const disabled =
              stage === 'borrow'
                ? p.borrower || p.repairing
                : stage === 'return'
                ? !p.borrower
                : false;
            return (
              <div
                key={p.id}
                style={{
                  border: '1px solid #ccc',
                  padding: 8,
                  textAlign: 'center'
                }}
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggleOne(p.id)}
                /><br/>
                <strong>{p.id}號筆</strong><br/>
                <div style={{ color: p.repairing ? 'gray' : p.borrower ? 'red' : 'black' }}>
                  {p.borrower || ''}
                </div>
                {p.startDate && (
                  <div style={{ fontSize: '0.8rem' }}>
                    {formatDate(p.startDate)} → {formatDate(p.endDate)}
                  </div>
                )}
                <div style={{ fontSize: '0.8rem' }}>{status}</div>
                {p.overdue && <div style={{ color: 'orange' }}>手動逾期</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* 操作按鈕 */}
      {stage !== 'overdue' && (
        <div style={{ marginTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(stage === 'borrow' || stage === 'admin') && (
            <button onClick={doBorrow}>點我按借用</button>
          )}
          {(stage === 'return' || stage === 'admin') && (
            <button onClick={doReturn}>點我按歸還</button>
          )}
          {stage === 'admin' && (
            <>
              <button onClick={doRepair}>報修</button>
              <button onClick={doRepairDone}>解除報修</button>
              <button onClick={doMarkOverdue}>標記逾期</button>
              <button onClick={doClearOverdue}>解除逾期</button>
              <button onClick={() => setStage('overdue')}>逾期未歸查詢</button>
            </>
          )}
        </div>
      )}

      {/* 逾期未歸清單 */}
      {stage === 'overdue' && (
        <div style={{ marginTop: 30 }}>
          <h3>逾期未歸查詢</h3>
          <p>
            請帥氣的你儘速聯絡逾期借用人，提醒他們歸還。
          </p>
          <ul>
            {overdueList.map(p => (
              <li key={p.id}>
                {p.borrower} – {p.id}號筆 – 應於 {formatDate(p.endDate)}
              </li>
            ))}
          </ul>
          <button onClick={() => setStage('admin')}>返回管理者介面</button>
        </div>
      )}
    </div>
  );
};

export default TabletPenTracker;
