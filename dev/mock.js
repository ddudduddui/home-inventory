// 로컬 미리보기용 가짜 Supabase (dev/preview.py 가 index.html 에 끼워 넣어요). 게시되는 web/ 에는 들어가지 않아요.
(function(){
  const d=(n)=>{const t=new Date();t.setDate(t.getDate()+n);return t.toISOString().slice(0,10);};
  const items=[
   {id:'1',name:'우유',category:'식료품',qty:1,room:'냉장고',spot:'문쪽',expiry:d(1),memo:'',updated_at:'3'},
   {id:'2',name:'AA 건전지',category:'생활용품',qty:8,room:'주방 상/하부장',spot:'하부장 왼쪽 서랍',expiry:null,memo:'',updated_at:'2'},
   {id:'3',name:'감기약',category:'의약품',qty:1,room:'붙박이장 2통',spot:'오른쪽 위칸',expiry:d(-2),memo:'',updated_at:'1'},
   {id:'4',name:'세제 리필',category:'생활용품',qty:2,room:'세탁기 선반',spot:'',expiry:null,memo:'',updated_at:'4'},
   {id:'5',name:'캠핑의자',category:'기타',qty:2,room:'베란다 창고',spot:'',expiry:null,memo:'',updated_at:'5'},
   {id:'6',name:'여권',category:'서류·귀중품',qty:1,room:'컴퓨터방 서랍장',spot:'맨 아래칸',expiry:null,memo:'',updated_at:'6'},
   {id:'7',name:'드라이버 세트',category:'공구',qty:1,room:'창고',spot:'',expiry:null,memo:'예전 위치',updated_at:'0'},
  ];
  const q={select(){return q},order(){return q},limit(){return Promise.resolve({data:items,error:null})},eq(){return q},maybeSingle(){return Promise.resolve({data:{alert_days:3}})},update(){return q},insert(){return Promise.resolve({})},delete(){return q}};
  window.supabase={createClient(){return{
    auth:{onAuthStateChange(cb){setTimeout(()=>cb('SIGNED_IN',{user:{id:'u',email:'demo@example.com'}}),0)},signOut(){}},
    rpc(){return Promise.resolve({data:true})},from(){return q},
    channel(){const c={on(){return c},subscribe(){return c}};return c},removeChannel(){}
  }}};
  try{sessionStorage.setItem('expPopupShown','1')}catch{}
})();
