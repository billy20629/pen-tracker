import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, doc, onSnapshot, setDoc, getDocs, updateDoc } from 'firebase/firestore';

const TabletPenTracker = () => {
  const [stage, setStage] = useState('selectMode');  // 'selectMode', 'enterName', 'borrow', 'return', 'admin'
  const [action, setAction] = useState('');
  const [userName, setUserName] = useState('');
  const [pens, setPens] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isManager = stage === 'admin' && userName.trim().toLowerCase() === 'billy';

  // format and calculate days
  const formatDate = date => date ? `${date.getFullYear()}/${(date.getMonth()+1).toString().padStart(2,'0')}/${date.getDate().toString().padStart(2,'0')}` : '';
  const remainingDays = end => end ? Math.ceil((new Date(end) - new Date())/(1000*60*60*24)) : null;

  // real-time fetch/init with onSnapshot
  useEffect(() => {
    if (stage === 'selectMode' || stage === 'enterName') return;
    const pensRef = collection(db, 'pens');
    const unsubscribe = onSnapshot(pensRef, snapshot => {
      if (snapshot.empty) {
        // 如果集合還沒初始化，就一次寫入 1~92 筆
        (async () => {
          const arr = [];
          for (let i = 1; i <= 92; i++) {
            await setDoc(doc(db,'pens',`${i}`), { borrower: null, startDate: null, endDate: null, repairing: false });
            arr.push({ id: i, borrower: null, startDate: null, endDate: null, repairing: false });
          }
          setPens(arr);
        })();
      } else {
        const arr = snapshot.docs.map(d => {
          const dt = d.data();
          return {
            id: parseInt(d.id, 10),
            borrower: dt.borrower,
            startDate: dt.startDate?.toDate() || null,
            endDate: dt.endDate?.toDate() || null,
            repairing: dt.repairing || false
          };
        });
        arr.sort((a, b) => a.id - b.id);
        setPens(arr);
      }
      setSelectedIds([]);
    });
    return () => unsubscribe();
  }, [stage]);

  const chooseMode = m => { setAction(m); setStage('enterName'); };
  const confirmName = () => {
    if (!userName.trim()) { alert('請注意輸入姓名正確與否'); return; }
    if (action==='admin' && userName.trim().toLowerCase() !== 'billy') { alert('管理者請輸入正確名稱'); return; }
    setStage(action);
  };
  const logout = () => {
    setStage('selectMode'); setAction(''); setUserName(''); setSelectedIds([]); setStartDate(''); setEndDate('');
  };

  const visible = (stage==='borrow' || stage==='admin')
    ? pens
    : stage==='return'
      ? (isManager ? pens : pens.filter(p => p.borrower === userName))
      : [];
  const allIds = visible.map(p => p.id);

  const toggleAll = () => setSelectedIds(prev => prev.length === allIds.length ? [] : allIds);
  const toggleOne = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const doBorrow = async () => {
    if (!selectedIds.length || !startDate || !endDate) return;
    const sd = new Date(startDate), ed = new Date(endDate);
    if (ed < sd) { alert('歸還日需>=起始日'); return; }
    const ok = [];
    for (let id of selectedIds) {
      const p = pens.find(x => x.id === id);
      if (!p.borrower && !p.repairing) {
        await updateDoc(doc(db, 'pens', `${id}`), { borrower: userName, startDate: sd, endDate: ed });
        ok.push(id);
      }
    }
    if (ok.length) alert('借用成功! 感謝您的借閱。請記得維護借用筆的清潔並定時充電避免人為損害，澄銘祝您使用順利!');
    setSelectedIds([]);
  };

  const doReturn = async () => {
    if (!selectedIds.length) return;
    if (!window.confirm(`確定歸還 ${selectedIds.join(', ')}？`)) return;
    const ok = [];
    for (let id of selectedIds) {
      const p = pens.find(x => x.id === id);
      if (isManager || p.borrower === userName) {
        await updateDoc(doc(db, 'pens', `${id}`), { borrower: null, startDate: null, endDate: null });
        ok.push(id);
      }
    }
    if (ok.length) alert(`成功歸還：${ok.join(', ')}`);
    setSelectedIds([]);
  };

  const doRepair = async () => {
    if (!isManager || !selectedIds.length) return;
    const ok = [];
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), { repairing: true });
      ok.push(id);
    }
    if (ok.length) alert(`已標記維修中：${ok.join(', ')}`);
    setSelectedIds([]);
  };

  const doRepairDone = async () => {
    if (!isManager || !selectedIds.length) return;
    const ok = [];
    for (let id of selectedIds) {
      await updateDoc(doc(db, 'pens', `${id}`), { repairing: false });
      ok.push(id);
    }
    if (ok.length) alert(`已完成維修：${ok.join(', ')}`);
    setSelectedIds([]);
  };

  const headerStyle = { padding:'20px', textAlign:'center', fontSize:'1.5rem' };
  const btnStyle = { fontSize:'1.2rem', padding:'10px 20px', margin:'5px' };
  const gridStyle = { display:'grid', gridTemplateColumns:'repeat(10,1fr)', gap:'10px', fontSize:'1rem' };

  if (stage === 'selectMode') return (
    <div style={headerStyle}>
      <h1>平板筆借閱系統</h1>
      <button style={btnStyle} onClick={() => chooseMode('borrow')}>借用模式</button>
      <button style={btnStyle} onClick={() => chooseMode('return')}>歸還模式</button>
      <button style={btnStyle} onClick={() => chooseMode('admin')}>管理者模式</button>
    </div>
  );

  if (stage === 'enterName') return (
    <div style={{padding:'20px',maxWidth:'400px',margin:'auto'}}>
      <h2 style={{fontSize:'1.3rem'}}>{action==='admin'?'管理者登入':(action==='borrow'?'借用登入':'歸還登入')}</h2>
      <input type='text' placeholder='輸入姓名' value={userName} onChange={e=>setUserName(e.target.value)} style={{width:'100%',padding:'8px',fontSize:'1rem',margin:'10px 0'}} />
      <button style={btnStyle} onClick={confirmName}>確定</button>
      <button style={btnStyle} onClick={logout}>取消</button>
    </div>
  );

  return (
    <div style={{padding:'20px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
        <h2 style={{fontSize:'1.3rem'}}>{action==='borrow'||stage==='admin'?'借用模式':'歸還模式'} - {isManager?'管理者':userName}</h2>
        <button style={btnStyle} onClick={logout}>登出</button>
      </div>
      {(action==='borrow'||stage==='admin') && (
        <div style={{margin:'10px 0'}}>
          <span style={{fontSize:'1rem'}}>請勾選您要借用的筆並選擇借用時間後按下借出。</span><br/>
          <label>起始日: <input type='date' value={startDate} onChange={e=>setStartDate(e.target.value)} /></label>
          <label style={{marginLeft:'10px'}}>歸還日: <input type='date' value={endDate} onChange={e=>setEndDate(e.target.value)} /></label>
        </div>
      )}
      <div style={gridStyle}>
        <div><input type='checkbox' checked={selectedIds.length===allIds.length} onChange={toggleAll} /> 全選</div>
        {visible.map(p => {
          const days = p.endDate ? remainingDays(p.endDate) : null;
          const status = p.repairing ? '維修中' : p.borrower ? (days <= 2 ? '短期' : '長期') : '可借用';
          const color = p.repairing ? 'gray' : p.borrower ? (days <= 2 ? 'purple' : 'red') : 'black';
          return (
            <div key={p.id} style={{border:'1px solid #ccc',padding:'8px',textAlign:'center',color}}>
              <input
                type='checkbox'
                disabled={(action==='borrow'&&(p.borrower||p.repairing))||(action==='return'&&!isManager&&p.borrower!==userName)}
                checked={selectedIds.includes(p.id)}
                onChange={()=>toggleOne(p.id)}
              /><br/>
              <span style={{fontSize:'1rem'}}>{p.id}號筆</span><br/>
              <span>{p.borrower||''}</span><br/>
              {p.startDate && <span style={{fontSize:'0.8rem'}}>{formatDate(p.startDate)}→{formatDate(p.endDate)}</span>}<br/>
              <span style={{fontSize:'0.8rem'}}>{status}</span>
            </div>
          );
        })}
      </div>
      <div style={{marginTop:'10px'}}>
        {(action==='borrow'||stage==='admin') && <button style={btnStyle} onClick={doBorrow}>借出</button>}
        {(action==='return'||stage==='admin') && <button style={btnStyle} onClick={doReturn}>歸還</button>}
        {stage==='admin' && (<><button style={btnStyle} onClick={doRepair}>報修</button><button style={btnStyle} onClick={doRepairDone}>維修完成</button></>)}
      </div>
    </div>
  );
};

export default TabletPenTracker;
