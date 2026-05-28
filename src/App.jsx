import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";

const SUPABASE_URL = "https://ragsmuubzjcxllvwdgfm.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJhZ3NtdXViempjeGxsdndkZ2ZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMjU0NzMsImV4cCI6MjA5NDcwMTQ3M30.vrqZesDext4I4um0k8sZLuPBdKhbhsy_03BZ-P7ch-M";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const BAR_COLORS = ["#1D9E75","#185FA5","#854F0B","#993C1D","#534AB7","#3B6D11","#712B13","#0F6E56"];
const NP_REASONS = ["Taller","Clima","Cliente","Personal","Falta de acceso","Otros"];
const ESTADOS = { sin_asignar:"Sin asignar", planificada:"Planificada", en_curso:"En curso", finalizada:"Finalizada" };
const ESTADO_COLORS = {
  sin_asignar:"bg-amber-50 text-amber-800 border-amber-200",
  planificada:"bg-blue-50 text-blue-800 border-blue-200",
  en_curso:"bg-teal-50 text-teal-800 border-teal-200",
  finalizada:"bg-gray-100 text-gray-600 border-gray-200"
};

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_SEMANA = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function fmtDate(d){ if(!d) return "—"; return new Date(d).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}); }
function toISO(d){ return d.toISOString().split("T")[0]; }
function getWeek(d){
  const dt=new Date(d); dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate()+3-(dt.getDay()+6)%7);
  const w1=new Date(dt.getFullYear(),0,4);
  return 1+Math.round(((dt-w1)/86400000-3+(w1.getDay()+6)%7)/7);
}
function diasLaborablesEnMes(year, month) {
  let count = 0;
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    const dw = d.getDay();
    if (dw !== 0 && dw !== 6) count++;
    d.setDate(d.getDate()+1);
  }
  return count;
}

// Escalas del Gantt
const ESCALAS = [
  { key:"semana", label:"Semana",  getDays:()=>{ const h=new Date(); h.setHours(0,0,0,0); return Array.from({length:7},(_,i)=>addDays(h,i)); }, fmt:(d)=>`${DIAS_SEMANA[d.getDay()]} ${d.getDate()}` },
  { key:"mes",    label:"Mes",     getDays:()=>{ const h=new Date(); h.setHours(0,0,0,0); return Array.from({length:30},(_,i)=>addDays(h,i)); }, fmt:(d)=>`${d.getDate()} ${MESES[d.getMonth()]}` },
  { key:"3m",     label:"3 meses", getDays:()=>{ const h=new Date(); h.setHours(0,0,0,0); const days=[]; for(let i=0;i<12;i++) days.push(addDays(h,i*7)); return days; }, fmt:(d)=>`S${getWeek(d)}` },
  { key:"6m",     label:"6 meses", getDays:()=>{ const h=new Date(); h.setHours(0,0,0,0); const days=[]; for(let i=0;i<12;i++) days.push(addDays(h,i*15)); return days; }, fmt:(d)=>`${d.getDate()} ${MESES[d.getMonth()]}` },
];

async function geocodeCP(cp) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${cp}&country=ES&format=json&limit=1`);
    const d = await r.json();
    if(d.length>0){ const p=d[0].display_name.split(", "); return {provincia:p[p.length-5]||"",poblacion:p[0]||"",lat:d[0].lat,lon:d[0].lon}; }
  } catch(e){}
  return null;
}

// ── UI BASE ───────────────────────────────────────────────────────────────────
function Modal({show,onClose,title,children,footer,wide}){
  if(!show) return null;
  return(
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-6 px-4 pb-8 overflow-y-auto">
      <div className={`bg-white rounded-2xl border border-gray-200 w-full ${wide?"max-w-2xl":"max-w-md"} shadow-xl`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-medium text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer&&<div className="px-5 py-4 border-t border-gray-100">{footer}</div>}
      </div>
    </div>
  );
}
function Btn({children,onClick,variant="primary",disabled,className=""}){
  const base="inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-40 cursor-pointer px-4 py-2 text-sm";
  const v={primary:"bg-teal-600 text-white hover:bg-teal-700 border border-teal-600",secondary:"bg-white text-gray-600 hover:bg-gray-50 border border-gray-200",danger:"bg-red-50 text-red-700 hover:bg-red-100 border border-red-200",blue:"bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"};
  return <button onClick={onClick} disabled={disabled} className={`${base} ${v[variant]||v.primary} ${className}`}>{children}</button>;
}
function Badge({estado}){
  return <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTADO_COLORS[estado]||"bg-gray-100 text-gray-600"}`}>{ESTADOS[estado]||estado}</span>;
}
function FL({label,children}){
  return(<div className="mb-3"><label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</label>{children}</div>);
}
function Sel({value,onChange,options,placeholder}){
  return(<select value={value||""} onChange={e=>onChange(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30">{placeholder&&<option value="">{placeholder}</option>}{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>);
}
function Inp({value,onChange,placeholder,type="text",className=""}){
  return(<input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className={`w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/30 ${className}`}/>);
}
function InfoRow({icon,label,val}){
  return(<div className="flex items-start gap-2"><span className="text-base w-5 shrink-0">{icon}</span><span className="text-gray-500 w-20 shrink-0 text-xs pt-0.5">{label}</span><span className="text-gray-800 font-medium text-sm flex-1">{val||"—"}</span></div>);
}
function ConfirmDialog({show,message,onConfirm,onCancel}){
  if(!show) return null;
  return(<div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] px-4"><div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-6 max-w-sm w-full"><p className="text-sm text-gray-800 mb-4">{message}</p><div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onCancel}>Cancelar</Btn><Btn variant="danger" onClick={onConfirm}>Sí, eliminar</Btn></div></div></div>);
}

// ── MODAL MOVIMIENTO ──────────────────────────────────────────────────────────
const EMPTY_MOV={camion_id:"",sondista_id:"",ayudante_id:"",numero_obra:"",tipo_via:"Calle",nombre_via:"",numero_via:"",info_adicional:"",cp:"",provincia:"",poblacion:"",latitud:"",longitud:"",fecha_inicio:"",fecha_fin:""};

function ModalMovimiento({show,onClose,camiones,personal,onSaved,asigEditar}){
  const [f,setF]=useState(EMPTY_MOV);
  const [geoLoading,setGeoLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const esEdicion=!!asigEditar;
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  useEffect(()=>{
    if(!show) return;
    if(asigEditar){
      const o=asigEditar.obra||{};
      setF({camion_id:asigEditar.camion_id||"",sondista_id:asigEditar.sondista_id||"",ayudante_id:asigEditar.ayudante_id||"",numero_obra:o.numero_obra||"",tipo_via:o.tipo_via||"Calle",nombre_via:o.nombre_via||"",numero_via:o.numero_via||"",info_adicional:o.info_adicional||"",cp:o.cp||"",provincia:o.provincia||"",poblacion:o.poblacion||"",latitud:o.latitud||"",longitud:o.longitud||"",fecha_inicio:asigEditar.fecha_inicio||"",fecha_fin:asigEditar.fecha_fin||""});
    } else { setF(EMPTY_MOV); }
    setError("");
  },[asigEditar,show]);

  const handleCP=async(v)=>{
    set("cp",v);
    if(v.length===5){setGeoLoading(true);const geo=await geocodeCP(v);if(geo){set("provincia",geo.provincia);set("poblacion",geo.poblacion);set("latitud",geo.lat);set("longitud",geo.lon);}setGeoLoading(false);}
  };

  const handleSave=async()=>{
    if(!f.camion_id||!f.sondista_id||!f.numero_obra||!f.fecha_inicio||!f.fecha_fin){setError("Completa: camión, sondista, nº obra y fechas.");return;}
    setSaving(true);setError("");
    if(esEdicion){
      const{error:e1}=await sb.from("asignaciones").update({camion_id:f.camion_id,sondista_id:f.sondista_id,ayudante_id:f.ayudante_id||null,fecha_inicio:f.fecha_inicio,fecha_fin:f.fecha_fin}).eq("id",asigEditar.id);
      if(e1){setError(e1.message);setSaving(false);return;}
      await sb.from("obras").update({tipo_via:f.tipo_via,nombre_via:f.nombre_via,numero_via:f.numero_via,info_adicional:f.info_adicional,cp:f.cp,provincia:f.provincia,poblacion:f.poblacion,latitud:f.latitud||null,longitud:f.longitud||null}).eq("id",asigEditar.obra_id);
    } else {
      let obra_id;
      const{data:oe}=await sb.from("obras").select("id").eq("numero_obra",f.numero_obra).single();
      if(oe){obra_id=oe.id;}
      else{const{data:on,error:e2}=await sb.from("obras").insert({numero_obra:f.numero_obra,tipo_via:f.tipo_via,nombre_via:f.nombre_via,numero_via:f.numero_via,info_adicional:f.info_adicional,cp:f.cp,provincia:f.provincia,poblacion:f.poblacion,latitud:f.latitud||null,longitud:f.longitud||null,estado:"planificada"}).select().single();if(e2){setError(e2.message);setSaving(false);return;}obra_id=on.id;}
      const{error:e3}=await sb.from("asignaciones").insert({obra_id,camion_id:f.camion_id,sondista_id:f.sondista_id,ayudante_id:f.ayudante_id||null,fecha_inicio:f.fecha_inicio,fecha_fin:f.fecha_fin});
      if(e3){setError(e3.message);setSaving(false);return;}
    }
    setSaving(false);onSaved();onClose();
  };

  const sondistas=personal.filter(p=>p.rol==="sondista").map(p=>({value:p.id,label:p.nombre}));
  const ayudantes=personal.filter(p=>p.rol==="ayudante").map(p=>({value:p.id,label:p.nombre}));

  return(
    <Modal show={show} onClose={onClose} wide title={esEdicion?`✏️ Editar movimiento — Obra #${asigEditar?.obra?.numero_obra}`:"＋ Nuevo movimiento"}
      footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={handleSave} disabled={saving}>{saving?"Guardando...":esEdicion?"✓ Guardar cambios":"✓ Añadir al cronograma"}</Btn></div>}>
      {error&&<div className="mb-3 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-200">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <FL label="Camión *"><Sel value={f.camion_id} onChange={v=>set("camion_id",v)} placeholder="Selecciona camión" options={camiones.map(c=>({value:c.id,label:`${c.matricula} · ${c.nombre}`}))}/></FL>
        <FL label="Nº de obra *"><Inp value={f.numero_obra} onChange={v=>set("numero_obra",v)} placeholder="Ej: 1045"/></FL>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FL label="Sondista *"><Sel value={f.sondista_id} onChange={v=>set("sondista_id",v)} placeholder="Selecciona sondista" options={sondistas}/></FL>
        <FL label="Ayudante"><Sel value={f.ayudante_id} onChange={v=>set("ayudante_id",v)} placeholder="Selecciona ayudante" options={ayudantes}/></FL>
      </div>
      <div className="border-t border-gray-100 my-3 pt-3">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Dirección de la obra</p>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <Sel value={f.tipo_via} onChange={v=>set("tipo_via",v)} options={["Calle","Avenida","Carretera","Paseo","Plaza","Camino","Polígono"].map(x=>({value:x,label:x}))}/>
          <div className="col-span-2"><Inp value={f.nombre_via} onChange={v=>set("nombre_via",v)} placeholder="Nombre de la vía"/></div>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Inp value={f.numero_via} onChange={v=>set("numero_via",v)} placeholder="Nº / Km"/>
          <Inp value={f.info_adicional} onChange={v=>set("info_adicional",v)} placeholder="Info adicional"/>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-1">
          <div><Inp value={f.cp} onChange={handleCP} placeholder="C.P."/>{geoLoading&&<p className="text-xs text-teal-600 mt-1">⟳ Buscando...</p>}</div>
          <Inp value={f.provincia} onChange={v=>set("provincia",v)} placeholder="Provincia"/>
          <Inp value={f.poblacion} onChange={v=>set("poblacion",v)} placeholder="Población"/>
        </div>
        <p className="text-xs text-gray-400 mb-1">O introduce coordenadas:</p>
        <div className="grid grid-cols-2 gap-2"><Inp value={f.latitud} onChange={v=>set("latitud",v)} placeholder="Latitud"/><Inp value={f.longitud} onChange={v=>set("longitud",v)} placeholder="Longitud"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <FL label="Fecha inicio *"><Inp type="date" value={f.fecha_inicio} onChange={v=>set("fecha_inicio",v)}/></FL>
        <FL label="Fecha fin estimada *"><Inp type="date" value={f.fecha_fin} onChange={v=>set("fecha_fin",v)}/></FL>
      </div>
    </Modal>
  );
}

// ── MODAL DETALLE BARRA ───────────────────────────────────────────────────────
function ModalDetalle({asig,onClose,onNP,onQuitarNP,onEditar,onEliminar}){
  if(!asig) return null;
  const{obra,camion,sondista,ayudante}=asig;
  const dir=obra?[obra.tipo_via,obra.nombre_via,obra.numero_via,obra.poblacion,obra.provincia].filter(Boolean).join(" "):"—";
  return(
    <Modal show={!!asig} onClose={onClose} title={`Obra #${obra?.numero_obra||"—"}`}
      footer={<div className="flex items-center gap-2 w-full flex-wrap">
        <Btn variant="danger" onClick={onEliminar}>🗑 Eliminar</Btn>
        <Btn variant="secondary" onClick={onEditar}>✏️ Editar</Btn>
        <div className="flex-1"/>
        {asig.es_dia_no_productivo
          ? <Btn variant="primary" onClick={onQuitarNP}>▶ Reactivar</Btn>
          : <Btn variant="blue" onClick={onNP}>⚠️ Día no productivo</Btn>}
      </div>}>
      <div className="space-y-3 text-sm">
        {asig.es_dia_no_productivo&&(
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700 flex items-center gap-2">
            ⚠️ Día no productivo — <strong>{asig.np_razon}</strong>{asig.np_texto_libre&&`: ${asig.np_texto_libre}`}
          </div>
        )}
        <InfoRow icon="🚛" label="Camión" val={camion?`${camion.matricula} · ${camion.nombre}`:"—"}/>
        <InfoRow icon="⛏" label="Sondista" val={sondista?.nombre}/>
        <InfoRow icon="👷" label="Ayudante" val={ayudante?.nombre}/>
        <InfoRow icon="📍" label="Dirección" val={dir}/>
        <InfoRow icon="📅" label="Fechas" val={`${fmtDate(asig.fecha_inicio)} → ${fmtDate(asig.fecha_fin)}`}/>
      </div>
    </Modal>
  );
}

// ── MODAL DÍA NO PRODUCTIVO ───────────────────────────────────────────────────
function ModalNP({show,onClose,onConfirm}){
  const[razon,setRazon]=useState("");
  const[texto,setTexto]=useState("");
  return(
    <Modal show={show} onClose={onClose} title="⚠️ Día no productivo"
      footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn variant="blue" disabled={!razon} onClick={()=>onConfirm(razon,texto)}>Confirmar</Btn></div>}>
      <p className="text-xs text-gray-500 mb-3">Indica el motivo por el que no se ha podido trabajar.</p>
      <div className="space-y-1 mb-3">
        {NP_REASONS.map(r=>(
          <button key={r} onClick={()=>setRazon(r)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${razon===r?"bg-orange-50 border-orange-300 text-orange-800 font-medium":"bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
            {r}
          </button>
        ))}
      </div>
      {razon==="Otros"&&(<div><textarea value={texto} onChange={e=>setTexto(e.target.value.slice(0,260))} placeholder="Describe el motivo..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-20 resize-none"/><p className="text-xs text-gray-400 text-right">{texto.length}/260</p></div>)}
    </Modal>
  );
}

// ── MODAL REGISTRO DIARIO (metros + consumibles) ──────────────────────────────
function ModalRegistroDiario({show,onClose,asignaciones,camiones,personal,productos,onSaved}){
  const[asigId,setAsigId]=useState("");
  const[fecha,setFecha]=useState(toISO(new Date()));
  const[metros,setMetros]=useState("");
  const[esNP,setEsNP]=useState(false);
  const[npRazon,setNpRazon]=useState("");
  const[npTexto,setNpTexto]=useState("");
  const[items,setItems]=useState([]);
  const[saving,setSaving]=useState(false);
  // Selección manual de equipo
  const[camionId,setCamionId]=useState("");
  const[sondistaId,setSondistaId]=useState("");
  const[ayudanteId,setAyudanteId]=useState("");

  useEffect(()=>{
    if(!show) return;
    // Resetear campos
    setAsigId(""); setFecha(toISO(new Date())); setMetros(""); setEsNP(false);
    setNpRazon(""); setNpTexto(""); setCamionId(""); setSondistaId(""); setAyudanteId("");
    // Cargar productos activos
    sb.from("productos").select("*").eq("activo",true).order("nombre").then(({data})=>{
      const prods=data||[];
      setItems(prods.length>0 ? prods.map(p=>({producto_id:p.id,nombre:p.nombre,unidad:p.unidad,cantidad:0,precio:p.precio_unitario})) : []);
    });
  },[show]);

  // Al seleccionar obra, prerellenar equipo si tiene asignación
  const handleAsigChange=(id)=>{
    setAsigId(id);
    // Buscar si hay asignación para esta obra y prerellenar equipo
    const asig=asignaciones.find(a=>a.obra_id===id);
    if(asig){
      setCamionId(asig.camion_id||"");
      setSondistaId(asig.sondista_id||"");
      setAyudanteId(asig.ayudante_id||"");
    } else {
      setCamionId(""); setSondistaId(""); setAyudanteId("");
    }
  };

  const upd=(i,k,v)=>setItems(prev=>prev.map((it,idx)=>idx===i?{...it,[k]:v}:it));
  const total=items.reduce((s,i)=>s+(parseFloat(i.cantidad)||0)*(parseFloat(i.precio)||0),0);

  // Cargar todas las obras directamente (no solo las que tienen asignación)
  const[todasObras,setTodasObras]=useState([]);
  useEffect(()=>{
    if(!show) return;
    sb.from("obras").select("*").order("numero_obra").then(({data})=>setTodasObras(data||[]));
  },[show]);

  const asigOptions=todasObras.map(o=>({value:o.id,label:`Obra #${o.numero_obra}${o.nombre_via?" · "+[o.tipo_via,o.nombre_via,o.numero_via].filter(Boolean).join(" "):""}`}));
  // asigSel ahora es la obra directamente
  const asigSel=todasObras.find(o=>o.id===asigId);

  const sondistas=personal.filter(p=>p.rol==="sondista").map(p=>({value:p.id,label:p.nombre}));
  const ayudantes=personal.filter(p=>p.rol==="ayudante").map(p=>({value:p.id,label:p.nombre}));

  const handleSave=async()=>{
    if(!asigId||!fecha||!camionId||!sondistaId){return;}
    setSaving(true);

    // ── Verificar si ya existe asignación para esta obra+camión
    // Si no existe, crearla automáticamente para que aparezca en el Gantt
    const asigExistente=asignaciones.find(a=>a.obra_id===asigId&&a.camion_id===camionId);
    if(!asigExistente){
      // Crear asignación retroactiva: fecha_inicio = fecha del registro, fecha_fin = misma fecha + 1 día por defecto
      const fechaFin=toISO(addDays(new Date(fecha),1));
      await sb.from("asignaciones").insert({
        obra_id:asigId,
        camion_id:camionId,
        sondista_id:sondistaId,
        ayudante_id:ayudanteId||null,
        fecha_inicio:fecha,
        fecha_fin:fechaFin
      });
    } else {
      // Si existe asignación pero el registro es anterior a fecha_inicio, extender hacia atrás
      if(fecha < asigExistente.fecha_inicio){
        await sb.from("asignaciones").update({fecha_inicio:fecha}).eq("id",asigExistente.id);
      }
      // Si el registro es posterior a fecha_fin, extender hacia adelante
      if(fecha > asigExistente.fecha_fin){
        await sb.from("asignaciones").update({fecha_fin:fecha}).eq("id",asigExistente.id);
      }
    }

    // ── Guardar el registro diario
    const reg={
      obra_id:asigId,
      camion_id:camionId,
      sondista_id:sondistaId,
      ayudante_id:ayudanteId||null,
      fecha,
      metros_sondeados:parseFloat(metros)||0,
      es_dia_no_productivo:esNP,
      np_razon:esNP?npRazon:null,
      np_texto_libre:esNP&&npRazon==="Otros"?npTexto:null
    };
    const{data:rd}=await sb.from("registros_diarios").insert(reg).select().single();

    // ── Guardar consumibles si no es día no productivo
    if(rd&&!esNP){
      const rows=items.filter(i=>parseFloat(i.cantidad)>0).map(i=>({
        obra_id:asigId,
        producto_id:i.producto_id,
        cantidad:parseFloat(i.cantidad),
        precio_unitario:parseFloat(i.precio),
        registro_diario_id:rd.id
      }));
      if(rows.length>0) await sb.from("inventario").insert(rows);
    }

    setSaving(false);onSaved();onClose();
  };

  return(
    <Modal show={show} onClose={onClose} wide title="📋 Registro diario — metros y consumibles"
      footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={handleSave} disabled={saving||!asigId||!camionId||!sondistaId}>{saving?"Guardando...":"💾 Guardar registro"}</Btn></div>}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <FL label="Obra *"><Sel value={asigId} onChange={handleAsigChange} placeholder="Selecciona obra" options={asigOptions}/></FL>
        <FL label="Fecha *"><Inp type="date" value={fecha} onChange={setFecha}/></FL>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-3">
        <FL label="Camión *"><Sel value={camionId} onChange={setCamionId} placeholder="Selecciona camión" options={camiones.map(c=>({value:c.id,label:`${c.matricula} · ${c.nombre}`}))}/></FL>
        <FL label="Sondista *"><Sel value={sondistaId} onChange={setSondistaId} placeholder="Selecciona sondista" options={sondistas}/></FL>
        <FL label="Ayudante"><Sel value={ayudanteId} onChange={setAyudanteId} placeholder="Selecciona ayudante" options={ayudantes}/></FL>
      </div>
      <div className="flex items-center gap-3 mb-3 p-3 bg-teal-50 rounded-xl border border-teal-200">
        <span className="text-2xl">📏</span>
        <div className="flex-1">
          <p className="text-xs font-medium text-teal-700 uppercase tracking-wide mb-1">Metros sondeados hoy</p>
          <input type="number" min="0" step="0.1" value={metros} onChange={e=>setMetros(e.target.value)} placeholder="0.0"
            className="w-full border border-teal-200 rounded-lg px-3 py-2 text-lg font-medium text-teal-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"/>
        </div>
        <div className="text-xs text-teal-600 font-medium">metros</div>
      </div>
      <div className="flex items-center gap-3 mb-4 p-3 bg-orange-50 rounded-xl border border-orange-200">
        <input type="checkbox" checked={esNP} onChange={e=>setEsNP(e.target.checked)} className="w-4 h-4 accent-orange-500"/>
        <span className="text-sm text-orange-700 font-medium">⚠️ Marcar como día no productivo</span>
      </div>
      {esNP&&(
        <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-200">
          <p className="text-xs font-medium text-orange-700 uppercase tracking-wide mb-2">Motivo</p>
          <div className="grid grid-cols-2 gap-1">
            {NP_REASONS.map(r=><button key={r} onClick={()=>setNpRazon(r)} className={`text-left px-3 py-2 rounded-lg text-xs border transition-colors ${npRazon===r?"bg-orange-100 border-orange-300 text-orange-800 font-medium":"bg-white border-gray-200 text-gray-700 hover:bg-orange-50"}`}>{r}</button>)}
          </div>
          {npRazon==="Otros"&&<textarea value={npTexto} onChange={e=>setNpTexto(e.target.value.slice(0,260))} placeholder="Describe el motivo..." className="mt-2 w-full border border-orange-200 rounded-lg px-3 py-2 text-sm h-16 resize-none"/>}
        </div>
      )}
      {!esNP&&(
        <>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 border-t border-gray-100 pt-3">Consumibles utilizados</p>
          {items.length === 0 && (
            <div className="text-center py-6 bg-amber-50 border border-amber-200 rounded-xl mb-3">
              <p className="text-sm text-amber-700 font-medium">No hay productos en el catálogo</p>
              <p className="text-xs text-amber-600 mt-1">Ve a <strong>Administración → 📦 Inventario</strong> y añade los productos primero</p>
            </div>
          )}
          {items.length > 0 && <table className="w-full text-sm mb-3">
            <thead><tr className="border-b border-gray-100"><th className="text-left pb-2 text-xs text-gray-500 font-medium">Producto</th><th className="text-center pb-2 text-xs text-gray-500 font-medium w-16">Uds.</th><th className="text-center pb-2 text-xs text-gray-500 font-medium w-20">€/ud</th><th className="text-right pb-2 text-xs text-gray-500 font-medium w-20">Total</th></tr></thead>
            <tbody>
              {items.map((it,i)=>(
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 pr-2 text-gray-800 text-xs">{it.nombre} <span className="text-gray-400">({it.unidad})</span></td>
                  <td className="py-2 px-1"><input type="number" min="0" step="0.5" value={it.cantidad} onChange={e=>upd(i,"cantidad",e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center"/></td>
                  <td className="py-2 px-1"><input type="number" min="0" step="0.01" value={it.precio} onChange={e=>upd(i,"precio",e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center"/></td>
                  <td className="py-2 pl-2 text-right font-medium text-xs">{((parseFloat(it.cantidad)||0)*(parseFloat(it.precio)||0)).toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>}
          <div className="flex justify-between items-center bg-teal-50 rounded-xl px-4 py-3 border border-teal-200">
            <span className="text-sm text-teal-700">Coste total materiales</span>
            <span className="text-lg font-medium text-teal-800">{total.toFixed(2)} €</span>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── GANTT ─────────────────────────────────────────────────────────────────────
function Gantt({camiones,asignaciones,registros,onBarClick}){
  const[escalaKey,setEscalaKey]=useState("semana");
  const[filtro,setFiltro]=useState("todos");
  const[filterInput,setFilterInput]=useState("");
  // offsetDays: días de desplazamiento desde hoy (negativo = pasado, positivo = futuro)
  const[offsetDays,setOffsetDays]=useState(0);

  const esc=ESCALAS.find(e=>e.key===escalaKey);

  // Fecha base = hoy + offset
  const baseDate=useMemo(()=>{
    const d=new Date(); d.setHours(0,0,0,0);
    return addDays(d,offsetDays);
  },[offsetDays]);

  // Generar columnas desde baseDate
  const cols=useMemo(()=>{
    if(escalaKey==="semana") return Array.from({length:7},(_,i)=>addDays(baseDate,i));
    if(escalaKey==="mes")    return Array.from({length:30},(_,i)=>addDays(baseDate,i));
    if(escalaKey==="3m")     return Array.from({length:12},(_,i)=>addDays(baseDate,i*7));
    return Array.from({length:12},(_,i)=>addDays(baseDate,i*15));
  },[escalaKey,baseDate]);

  const spanDays=escalaKey==="semana"?7:escalaKey==="mes"?30:escalaKey==="3m"?84:180;

  // Salto del slider según escala
  const sliderStep=escalaKey==="semana"?1:escalaKey==="mes"?7:30;
  const sliderMin=-365;
  const sliderMax=365;

  // Label de periodo mostrado
  const periodoLabel=useMemo(()=>{
    const ini=cols[0];
    const fin=cols[cols.length-1];
    const fmtShort=(d)=>d.toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"});
    return `${fmtShort(ini)} — ${fmtShort(fin)}`;
  },[cols]);

  const isHoy=offsetDays===0;

  const filteredCamiones=camiones.filter(c=>{
    if(filtro==="todos") return true;
    return asignaciones.filter(a=>a.camion_id===c.id).some(a=>{
      if(filtro==="obra"&&filterInput) return a.obra?.numero_obra?.toLowerCase().includes(filterInput.toLowerCase());
      if(filtro==="cp"&&filterInput) return a.obra?.cp?.startsWith(filterInput);
      if(filtro==="provincia"&&filterInput) return a.obra?.provincia?.toLowerCase().includes(filterInput.toLowerCase());
      return true;
    });
  });

  return(
    <div>
      {/* Controles superiores */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-xs text-gray-500 font-medium">Escala:</span>
        {ESCALAS.map(e=>(
          <button key={e.key} onClick={()=>{setEscalaKey(e.key);setOffsetDays(0);}}
            className={`px-3 py-1 rounded-lg text-xs border transition-colors ${escalaKey===e.key?"bg-blue-50 border-blue-300 text-blue-700 font-medium":"bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            {e.label}
          </button>
        ))}
        <span className="text-xs text-gray-500 font-medium ml-3">Filtrar:</span>
        <select value={filtro} onChange={e=>{setFiltro(e.target.value);setFilterInput("");}} className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white">
          <option value="todos">Todos</option>
          <option value="obra">Por nº obra</option>
          <option value="cp">Por C.P.</option>
          <option value="provincia">Por provincia</option>
        </select>
        {filtro!=="todos"&&<Inp value={filterInput} onChange={setFilterInput} placeholder={filtro==="obra"?"Nº obra...":filtro==="cp"?"C.P....":"Provincia..."} className="w-32 text-xs py-1"/>}
      </div>

      {/* Slider de navegación temporal */}
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-3">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={()=>setOffsetDays(p=>p-sliderStep)}
            className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold transition-colors">‹</button>
          <div className="flex-1">
            <input type="range" min={sliderMin} max={sliderMax} step={sliderStep} value={offsetDays}
              onChange={e=>setOffsetDays(parseInt(e.target.value))}
              className="w-full accent-teal-600 cursor-pointer"/>
          </div>
          <button onClick={()=>setOffsetDays(p=>p+sliderStep)}
            className="w-7 h-7 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 text-sm font-bold transition-colors">›</button>
          <button onClick={()=>setOffsetDays(0)}
            className={`px-3 py-1 rounded-lg text-xs border transition-colors ${isHoy?"bg-teal-50 border-teal-300 text-teal-700 font-medium":"bg-white border-gray-200 text-gray-500 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700"}`}>
            Hoy
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">
            {offsetDays<0?`← ${Math.abs(offsetDays)} días atrás`:offsetDays>0?`${offsetDays} días adelante →`:"Periodo actual"}
          </span>
          <span className="text-xs font-medium text-gray-600">{periodoLabel}</span>
        </div>
      </div>

      {/* Gantt */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
        <div className="flex border-b border-gray-100" style={{minWidth:cols.length>14?`${cols.length*42+176}px`:"100%"}}>
          <div className="w-44 shrink-0 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500 border-r border-gray-100">Camión</div>
          <div className="flex-1 grid" style={{gridTemplateColumns:`repeat(${cols.length},1fr)`}}>
            {cols.map((d,i)=>{
              const esHoy=toISO(d)===toISO(new Date());
              return(
                <div key={i} className={`px-1 py-2 text-xs text-center border-r border-gray-100 last:border-r-0 font-medium ${esHoy?"bg-teal-50 text-teal-700":d.getDay()===0||d.getDay()===6?"text-gray-300":"text-gray-400"}`}
                  style={{minWidth:escalaKey==="mes"?"38px":"auto"}}>
                  {esc.fmt(d)}
                  {esHoy&&<div className="w-1 h-1 rounded-full bg-teal-500 mx-auto mt-0.5"></div>}
                </div>
              );
            })}
          </div>
        </div>
        {filteredCamiones.length===0&&<div className="px-4 py-10 text-sm text-gray-400 text-center">No hay resultados para ese filtro</div>}
        {filteredCamiones.map((c,ci)=>{
          const asigs=asignaciones.filter(a=>a.camion_id===c.id);
          return(
            <div key={c.id} className="flex border-b border-gray-100 last:border-b-0" style={{minHeight:52,minWidth:cols.length>14?`${cols.length*42+176}px`:"100%"}}>
              <div className="w-44 shrink-0 bg-gray-50 px-3 py-3 border-r border-gray-100 flex items-center gap-2">
                <span className="text-xl">🚛</span>
                <div><div className="text-xs font-medium text-gray-800 leading-tight">{c.nombre}</div><div className="text-xs text-gray-400">{c.matricula}</div></div>
              </div>
              <div className="flex-1 relative" style={{minHeight:52}}>
                <div className="absolute inset-0 grid pointer-events-none" style={{gridTemplateColumns:`repeat(${cols.length},1fr)`}}>
                  {cols.map((d,i)=>{
                    const esHoy=toISO(d)===toISO(new Date());
                    return <div key={i} className={`border-r border-gray-100 last:border-r-0 h-full ${esHoy?"bg-teal-50/40":d.getDay()===0||d.getDay()===6?"bg-gray-50/50":""}`}/>;
                  })}
                </div>
                {asigs.map((a)=>{
                  const start=daysBetween(baseDate,a.fecha_inicio);
                  const end=daysBetween(baseDate,a.fecha_fin);
                  if(end<0||start>spanDays) return null;
                  const left=Math.max(0,(start/spanDays)*100);
                  const right=Math.min(100,((end+1)/spanDays)*100);
                  const width=right-left;
                  if(width<=0) return null;
                  const col=BAR_COLORS[ci%BAR_COLORS.length];
                  const hasNP=registros.some(r=>r.obra_id===a.obra_id&&r.es_dia_no_productivo);
                  return(
                    <div key={a.id} onClick={()=>onBarClick(a)}
                      title={`Obra #${a.obra?.numero_obra}`}
                      style={{left:`${left}%`,width:`${width}%`,background:hasNP?"transparent":col,
                        border:hasNP?`2px dashed #f97316`:"none",top:"50%",transform:"translateY(-50%)"}}
                      className="absolute h-7 rounded-md flex items-center px-2 cursor-pointer hover:brightness-90 transition-all overflow-hidden">
                      {hasNP&&<span className="text-xs mr-1" style={{color:"#f97316"}}>⚠️</span>}
                      <span className="text-xs font-medium truncate" style={{color:hasNP?"#f97316":"white",textShadow:hasNP?"none":"0 1px 2px rgba(0,0,0,0.3)"}}>#{a.obra?.numero_obra}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ── PANEL KPIs ────────────────────────────────────────────────────────────────
function PanelKPIs({camiones,personal,asignaciones,registros,onGoAdmin}){
  const[agrupar,setAgrupar]=useState("mes");
  const[agruparPor,setAgruparPor]=useState("total");
  const[fechaDesde,setFechaDesde]=useState("");
  const[fechaHasta,setFechaHasta]=useState("");

  const sondistas=personal.filter(p=>p.rol==="sondista");
  const ayudantes=personal.filter(p=>p.rol==="ayudante");
  const obrasEnCurso=asignaciones.filter(a=>a.obra?.estado==="en_curso");

  // KPI summary cards
  const kpiCards=[
    {icon:"🚛",label:"Camiones activos",val:camiones.length,action:()=>onGoAdmin("camiones")},
    {icon:"⛏",label:"Sondistas",val:sondistas.length,action:()=>onGoAdmin("personal")},
    {icon:"👷",label:"Ayudantes",val:ayudantes.length,action:()=>onGoAdmin("personal")},
    {icon:"🏗",label:"Obras en curso",val:obrasEnCurso.length,action:()=>onGoAdmin("obras")},
  ];

  // Filtrar registros por fecha
  const regsFiltrados=useMemo(()=>{
    return registros.filter(r=>{
      if(fechaDesde&&r.fecha<fechaDesde) return false;
      if(fechaHasta&&r.fecha>fechaHasta) return false;
      return true;
    });
  },[registros,fechaDesde,fechaHasta]);

  // Datos gráfico metros
  const chartData=useMemo(()=>{
    if(agrupar==="mes"){
      const mapa={};
      for(let m=0;m<12;m++) mapa[m]={name:MESES[m],metros:0,dias:0};
      regsFiltrados.filter(r=>!r.es_dia_no_productivo).forEach(r=>{
        const m=new Date(r.fecha).getMonth();
        if(agruparPor==="total"){ mapa[m].metros+=r.metros_sondeados||0; mapa[m].dias+=1; }
        else if(agruparPor==="camion"){
          const cam=camiones.find(c=>c.id===r.camion_id);
          const key=cam?.matricula||"Sin asignar";
          if(!mapa[m][key]) mapa[m][key]=0;
          mapa[m][key]+=r.metros_sondeados||0;
        } else if(agruparPor==="sondista"){
          const sond=personal.find(p=>p.id===r.sondista_id);
          const key=sond?.nombre||"Sin asignar";
          if(!mapa[m][key]) mapa[m][key]=0;
          mapa[m][key]+=r.metros_sondeados||0;
        } else if(agruparPor==="ayudante"){
          const ay=personal.find(p=>p.id===r.ayudante_id);
          const key=ay?.nombre||"Sin asignar";
          if(!mapa[m][key]) mapa[m][key]=0;
          mapa[m][key]+=r.metros_sondeados||0;
        }
      });
      return Object.values(mapa);
    }
    // por día
    const mapa={};
    regsFiltrados.filter(r=>!r.es_dia_no_productivo).forEach(r=>{
      if(!mapa[r.fecha]) mapa[r.fecha]={name:r.fecha,metros:0};
      mapa[r.fecha].metros+=r.metros_sondeados||0;
    });
    return Object.values(mapa).sort((a,b)=>a.name.localeCompare(b.name));
  },[regsFiltrados,agrupar,agruparPor,camiones,personal]);

  // Dias no productivos por mes
  const npData=useMemo(()=>{
    const hoy=new Date();
    return MESES.map((m,i)=>{
      const laborables=diasLaborablesEnMes(hoy.getFullYear(),i);
      const diasNP=registros.filter(r=>r.es_dia_no_productivo&&new Date(r.fecha).getMonth()===i).length;
      const diasProd=registros.filter(r=>!r.es_dia_no_productivo&&r.metros_sondeados>0&&new Date(r.fecha).getMonth()===i).length;
      const pct=laborables>0?Math.round((diasProd/laborables)*100):0;
      return{name:m,laborables,diasProd,diasNP,pct};
    });
  },[registros]);

  // Metros diarios (últimos 30 días)
  const metrosDiarios=useMemo(()=>{
    const hoy=new Date(); hoy.setHours(0,0,0,0);
    const data=[];
    for(let i=29;i>=0;i--){
      const d=addDays(hoy,-i);
      const iso=toISO(d);
      const total=registros.filter(r=>r.fecha===iso&&!r.es_dia_no_productivo).reduce((s,r)=>s+(r.metros_sondeados||0),0);
      data.push({name:`${d.getDate()} ${MESES[d.getMonth()]}`,metros:total});
    }
    return data;
  },[registros]);

  const barKeys=useMemo(()=>{
    if(agruparPor==="total") return ["metros"];
    const keys=new Set();
    chartData.forEach(d=>Object.keys(d).filter(k=>k!=="name"&&k!=="dias"&&k!=="metros").forEach(k=>keys.add(k)));
    return Array.from(keys);
  },[chartData,agruparPor]);

  return(
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiCards.map((k,i)=>(
          <div key={i} onClick={k.action} className="bg-white border border-gray-200 rounded-2xl p-4 cursor-pointer hover:border-teal-300 hover:shadow-sm transition-all group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">{k.icon}</span>
              <span className="text-xs text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">＋ Añadir →</span>
            </div>
            <div className="text-2xl font-medium text-gray-900">{k.val}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros KPI */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">Ver por:</span>
          {["mes","dia"].map(g=>(
            <button key={g} onClick={()=>setAgrupar(g)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors ${agrupar===g?"bg-blue-50 border-blue-300 text-blue-700 font-medium":"bg-white border-gray-200 text-gray-500"}`}>
              {g==="mes"?"Meses":"Días"}
            </button>
          ))}
          <span className="text-xs text-gray-500 font-medium ml-2">Agrupar por:</span>
          {["total","camion","sondista","ayudante"].map(g=>(
            <button key={g} onClick={()=>setAgruparPor(g)}
              className={`px-3 py-1 rounded-lg text-xs border transition-colors capitalize ${agruparPor===g?"bg-teal-50 border-teal-300 text-teal-700 font-medium":"bg-white border-gray-200 text-gray-500"}`}>
              {g==="total"?"Total":g.charAt(0).toUpperCase()+g.slice(1)}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">Desde:</span>
            <Inp type="date" value={fechaDesde} onChange={setFechaDesde} className="text-xs py-1 w-32"/>
            <span className="text-xs text-gray-500">Hasta:</span>
            <Inp type="date" value={fechaHasta} onChange={setFechaHasta} className="text-xs py-1 w-32"/>
            {(fechaDesde||fechaHasta)&&<button onClick={()=>{setFechaDesde("");setFechaHasta("");}} className="text-xs text-gray-400 hover:text-gray-600">✕ Limpiar</button>}
          </div>
        </div>
      </div>

      {/* Gráfico metros sondeados */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">📏 Metros sondeados</h3>
        {chartData.every(d=>!d.metros&&barKeys.every(k=>!d[k]))
          ? <div className="text-center py-12 text-gray-400 text-sm">Sin registros de metros aún. Añade registros diarios para ver datos.</div>
          : <ResponsiveContainer width="100%" height={280}>
              {agruparPor==="total"
                ? <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v)=>[`${v} m`,"Metros"]}/><Bar dataKey="metros" fill="#1D9E75" radius={[4,4,0,0]}/></BarChart>
                : <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/><XAxis dataKey="name" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip formatter={(v,n)=>[`${v} m`,n]}/><Legend/>{barKeys.map((k,i)=><Bar key={k} dataKey={k} fill={BAR_COLORS[i%BAR_COLORS.length]} radius={[4,4,0,0]} stackId="a"/>)}</BarChart>
              }
            </ResponsiveContainer>
        }
      </div>

      {/* Productividad */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">📊 Productividad mensual — días sondeados vs laborables</h3>
        {registros.length===0
          ? <div className="text-center py-12 text-gray-400 text-sm">Sin registros aún.</div>
          : <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={npData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                  <XAxis dataKey="name" tick={{fontSize:11}}/>
                  <YAxis tick={{fontSize:11}}/>
                  <Tooltip/>
                  <Legend/>
                  <Bar dataKey="diasProd" name="Días productivos" fill="#1D9E75" radius={[4,4,0,0]}/>
                  <Bar dataKey="diasNP" name="Días no productivos" fill="#f97316" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">
                {npData.map((m,i)=>(
                  <div key={i} className="text-center p-2 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-xs font-medium text-gray-600 mb-1">{m.name}</div>
                    <div className={`text-sm font-medium ${m.pct>=80?"text-teal-600":m.pct>=50?"text-amber-600":"text-red-500"}`}>{m.pct}%</div>
                    <div className="text-xs text-gray-400">{m.diasProd}/{m.laborables}d</div>
                  </div>
                ))}
              </div>
            </>
        }
      </div>

      {/* Metros diarios últimos 30 días */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-4">📈 Metros diarios — últimos 30 días</h3>
        {metrosDiarios.every(d=>d.metros===0)
          ? <div className="text-center py-12 text-gray-400 text-sm">Sin registros en los últimos 30 días.</div>
          : <ResponsiveContainer width="100%" height={220}>
              <LineChart data={metrosDiarios}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="name" tick={{fontSize:10}} interval={4}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip formatter={(v)=>[`${v} m`,"Metros"]}/>
                <Line type="monotone" dataKey="metros" stroke="#185FA5" strokeWidth={2} dot={{r:3}} activeDot={{r:5}}/>
              </LineChart>
            </ResponsiveContainer>
        }
      </div>
    </div>
  );
}

// ── PANEL OBRAS ───────────────────────────────────────────────────────────────
function PanelObras({asignaciones,productos,registros}){
  const[filtroEstado,setFiltroEstado]=useState("todas");
  const[filtroTexto,setFiltroTexto]=useState("");
  const[invObra,setInvObra]=useState(null);

  const obras=asignaciones.map(a=>a.obra).filter(Boolean).filter((o,i,arr)=>arr.findIndex(x=>x?.id===o?.id)===i);
  const filtered=obras.filter(o=>{
    const estadoOk=filtroEstado==="todas"||o.estado===filtroEstado;
    const textoOk=!filtroTexto||o.numero_obra?.includes(filtroTexto)||o.provincia?.toLowerCase().includes(filtroTexto.toLowerCase())||o.poblacion?.toLowerCase().includes(filtroTexto.toLowerCase());
    return estadoOk&&textoOk;
  });

  return(
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="text-xs text-gray-500 font-medium">Estado:</span>
        {["todas","sin_asignar","planificada","en_curso","finalizada"].map(e=>(
          <button key={e} onClick={()=>setFiltroEstado(e)}
            className={`px-3 py-1 rounded-lg text-xs border transition-colors ${filtroEstado===e?"bg-teal-50 border-teal-300 text-teal-700 font-medium":"bg-white border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            {e==="todas"?"Todas":ESTADOS[e]}
          </button>
        ))}
        <Inp value={filtroTexto} onChange={setFiltroTexto} placeholder="Buscar obra, provincia..." className="ml-auto w-48 text-xs py-1"/>
      </div>
      {filtered.length===0&&<div className="text-sm text-gray-400 text-center py-12">No hay obras con esos filtros</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(obra=>{
          const asig=asignaciones.find(a=>a.obra_id===obra.id);
          const dir=[obra.tipo_via,obra.nombre_via,obra.numero_via,obra.poblacion].filter(Boolean).join(" ");
          const metrosObra=registros.filter(r=>r.obra_id===obra.id&&!r.es_dia_no_productivo).reduce((s,r)=>s+(r.metros_sondeados||0),0);
          return(
            <div key={obra.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:border-gray-300 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className="text-sm font-medium text-gray-900">Obra #{obra.numero_obra}</span>
                <Badge estado={obra.estado}/>
              </div>
              <p className="text-xs text-gray-500 mb-2">📍 {dir||"Sin dirección"}</p>
              {asig&&<><p className="text-xs text-gray-700">🚛 {asig.camion?.matricula||"—"} · ⛏ {asig.sondista?.nombre||"—"}</p><p className="text-xs text-gray-400 mt-1">📅 {fmtDate(asig.fecha_inicio)} → {fmtDate(asig.fecha_fin)}</p></>}
              {metrosObra>0&&<p className="text-xs text-teal-700 mt-2 font-medium">📏 {metrosObra.toFixed(1)} m sondeados</p>}
              {obra.estado!=="sin_asignar"&&(
                <button onClick={()=>setInvObra(obra)} className="mt-3 w-full text-xs text-gray-500 hover:text-teal-600 border border-gray-200 hover:border-teal-200 rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1">📦 Ver inventario y costes</button>
              )}
            </div>
          );
        })}
      </div>
      {invObra&&<ModalInventario show={!!invObra} obra={invObra} onClose={()=>setInvObra(null)} productos={productos} registros={registros}/>}
    </div>
  );
}

// ── MODAL INVENTARIO ──────────────────────────────────────────────────────────
function ModalInventario({obra,show,onClose,productos,registros}){
  const[items,setItems]=useState([]);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!show||!obra) return;
    sb.from("inventario").select("*, producto:productos(*)").eq("obra_id",obra.id).then(({data})=>{
      if(data&&data.length>0) setItems(data.map(d=>({id:d.id,producto_id:d.producto_id,nombre:d.producto?.nombre||"",unidad:d.producto?.unidad||"",cantidad:d.cantidad,precio:d.precio_unitario})));
      else setItems(productos.slice(0,6).map(p=>({producto_id:p.id,nombre:p.nombre,unidad:p.unidad,cantidad:0,precio:p.precio_unitario})));
    });
  },[show,obra,productos]);

  const upd=(i,k,v)=>setItems(prev=>prev.map((it,idx)=>idx===i?{...it,[k]:v}:it));
  const total=items.reduce((s,i)=>s+(parseFloat(i.cantidad)||0)*(parseFloat(i.precio)||0),0);
  const metrosObra=registros.filter(r=>r.obra_id===obra?.id&&!r.es_dia_no_productivo).reduce((s,r)=>s+(r.metros_sondeados||0),0);

  const handleSave=async()=>{
    setSaving(true);
    await sb.from("inventario").delete().eq("obra_id",obra.id);
    const rows=items.filter(i=>parseFloat(i.cantidad)>0).map(i=>({obra_id:obra.id,producto_id:i.producto_id,cantidad:parseFloat(i.cantidad),precio_unitario:parseFloat(i.precio)}));
    if(rows.length>0) await sb.from("inventario").insert(rows);
    setSaving(false);onClose();
  };

  return(
    <Modal show={show} onClose={onClose} wide title={`📦 Inventario — Obra #${obra?.numero_obra||""}`}
      footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cerrar</Btn><Btn onClick={handleSave} disabled={saving}>{saving?"Guardando...":"💾 Guardar"}</Btn></div>}>
      {metrosObra>0&&<div className="mb-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 flex items-center gap-3"><span className="text-2xl">📏</span><div><p className="text-xs text-teal-600 font-medium uppercase tracking-wide">Total metros sondeados</p><p className="text-xl font-medium text-teal-800">{metrosObra.toFixed(1)} m</p></div></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-100"><th className="text-left pb-2 text-xs text-gray-500 font-medium">Producto</th><th className="text-center pb-2 text-xs text-gray-500 font-medium w-16">Uds.</th><th className="text-center pb-2 text-xs text-gray-500 font-medium w-20">€/ud</th><th className="text-right pb-2 text-xs text-gray-500 font-medium w-20">Total</th></tr></thead>
          <tbody>{items.map((it,i)=>(<tr key={i} className="border-b border-gray-50"><td className="py-2 pr-2 text-gray-800">{it.nombre} <span className="text-gray-400 text-xs">({it.unidad})</span></td><td className="py-2 px-1"><input type="number" min="0" step="0.5" value={it.cantidad} onChange={e=>upd(i,"cantidad",e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center"/></td><td className="py-2 px-1"><input type="number" min="0" step="0.01" value={it.precio} onChange={e=>upd(i,"precio",e.target.value)} className="w-full border border-gray-200 rounded px-2 py-1 text-xs text-center"/></td><td className="py-2 pl-2 text-right font-medium">{((parseFloat(it.cantidad)||0)*(parseFloat(it.precio)||0)).toFixed(2)}€</td></tr>))}</tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-between items-center bg-teal-50 rounded-xl px-4 py-3 border border-teal-200">
        <span className="text-sm text-teal-700">Coste total materiales</span>
        <span className="text-xl font-medium text-teal-800">{total.toFixed(2)} €</span>
      </div>
    </Modal>
  );
}

// ── PANEL ADMIN ───────────────────────────────────────────────────────────────
function PanelAdmin({camiones,personal,seccionInicial,onRefresh}){
  const[seccion,setSeccion]=useState(seccionInicial||"camiones");
  const[showModal,setShowModal]=useState(false);
  const[editando,setEditando]=useState(null);
  const[confirm,setConfirm]=useState(null);

  useEffect(()=>{ if(seccionInicial) setSeccion(seccionInicial); },[seccionInicial]);

  const cerrar=()=>{setShowModal(false);setEditando(null);};
  const eliminar=async(tabla,id)=>{ await sb.from(tabla).delete().eq("id",id); setConfirm(null); onRefresh(); };

  return(
    <div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {["camiones","personal","obras","inventario"].map(s=>(
          <button key={s} onClick={()=>setSeccion(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${seccion===s?"bg-gray-900 text-white border-gray-900":"bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
            {s==="camiones"?"🚛 Camiones":s==="personal"?"👷 Personal":s==="obras"?"🏗 Obras":"📦 Inventario"}
          </button>
        ))}
        <button onClick={()=>{setEditando(null);setShowModal(true);}} className="ml-auto px-4 py-2 rounded-xl text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
          ＋ {seccion==="camiones"?"Camión":seccion==="personal"?"Empleado":seccion==="obras"?"Obra":"Producto"}
        </button>
      </div>
      {seccion==="camiones"&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {camiones.map(c=>(
            <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-xl">🚛</div><div><p className="text-sm font-medium text-gray-900">{c.nombre}</p><p className="text-xs text-gray-500">{c.matricula}</p></div></div>
                <div className="flex gap-1">
                  <button onClick={()=>{setEditando({...c,_tabla:"camiones"});setShowModal(true);}} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">✏️</button>
                  <button onClick={()=>setConfirm({tabla:"camiones",id:c.id,nombre:c.nombre})} className="text-xs text-red-400 px-2 py-1 rounded border border-red-100 hover:bg-red-50">🗑</button>
                </div>
              </div>
              {c.modelo&&<p className="text-xs text-gray-400">Modelo: {c.modelo}</p>}
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full border ${c.activo?"bg-teal-50 text-teal-700 border-teal-200":"bg-gray-100 text-gray-500 border-gray-200"}`}>{c.activo?"Activo":"Inactivo"}</span>
            </div>
          ))}
        </div>
      )}
      {seccion==="personal"&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {personal.map(p=>(
            <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-base font-medium text-blue-700 overflow-hidden">
                    {p.foto_url?<img src={p.foto_url} alt={p.nombre} className="w-full h-full object-cover"/>:p.nombre.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()}
                  </div>
                  <div><p className="text-sm font-medium text-gray-900">{p.nombre}</p><p className="text-xs text-gray-500 capitalize">{p.rol}</p></div>
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>{setEditando({...p,_tabla:"personal"});setShowModal(true);}} className="text-xs text-gray-400 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">✏️</button>
                  <button onClick={()=>setConfirm({tabla:"personal",id:p.id,nombre:p.nombre})} className="text-xs text-red-400 px-2 py-1 rounded border border-red-100 hover:bg-red-50">🗑</button>
                </div>
              </div>
              {p.telefono&&<p className="text-xs text-gray-400">📞 {p.telefono}</p>}
              {p.email&&<p className="text-xs text-gray-400">✉️ {p.email}</p>}
            </div>
          ))}
        </div>
      )}
      {seccion==="obras"&&<PanelObrasAdmin onRefresh={onRefresh}/>}
      {seccion==="inventario"&&<PanelInventarioAdmin onEditar={(p)=>{setEditando(p);setShowModal(true);}} onRefresh={onRefresh}/>}
      {showModal&&(seccion==="camiones"?<ModalCamion show item={editando} onClose={cerrar} onSaved={()=>{cerrar();onRefresh();}}/>:seccion==="personal"?<ModalPersonal show item={editando} onClose={cerrar} onSaved={()=>{cerrar();onRefresh();}}/>:seccion==="obras"?<ModalObraAdmin show item={editando} onClose={cerrar} onSaved={()=>{cerrar();onRefresh();}}/>:<ModalProducto show item={editando} onClose={cerrar} onSaved={()=>{cerrar();onRefresh();}}/>)}
      <ConfirmDialog show={!!confirm} message={`¿Eliminar "${confirm?.nombre}"?`} onConfirm={()=>eliminar(confirm.tabla,confirm.id)} onCancel={()=>setConfirm(null)}/>
    </div>
  );
}

function ModalCamion({show,item,onClose,onSaved}){
  const[f,setF]=useState({nombre:"",matricula:"",modelo:"",activo:true});
  const[saving,setSaving]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  useEffect(()=>{if(item)setF({nombre:item.nombre||"",matricula:item.matricula||"",modelo:item.modelo||"",activo:item.activo??true});else setF({nombre:"",matricula:"",modelo:"",activo:true});},[item,show]);
  const handleSave=async()=>{if(!f.nombre||!f.matricula)return;setSaving(true);if(item?.id)await sb.from("camiones").update({nombre:f.nombre,matricula:f.matricula,modelo:f.modelo,activo:f.activo}).eq("id",item.id);else await sb.from("camiones").insert({nombre:f.nombre,matricula:f.matricula,modelo:f.modelo,activo:f.activo});setSaving(false);onSaved();};
  return(<Modal show={show} onClose={onClose} title={item?.id?"✏️ Editar camión":"🚛 Nuevo camión"} footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={handleSave} disabled={saving||!f.nombre||!f.matricula}>{saving?"Guardando...":"Guardar"}</Btn></div>}><FL label="Nombre *"><Inp value={f.nombre} onChange={v=>set("nombre",v)} placeholder="Ej: Boart Longyear BL7"/></FL><FL label="Matrícula *"><Inp value={f.matricula} onChange={v=>set("matricula",v)} placeholder="Ej: SE-1234-AB"/></FL><FL label="Modelo"><Inp value={f.modelo} onChange={v=>set("modelo",v)} placeholder="Ej: BL-7"/></FL><FL label="Estado"><Sel value={f.activo?"true":"false"} onChange={v=>set("activo",v==="true")} options={[{value:"true",label:"Activo"},{value:"false",label:"Inactivo"}]}/></FL></Modal>);
}

function ModalPersonal({show,item,onClose,onSaved}){
  const[f,setF]=useState({nombre:"",rol:"sondista",telefono:"",email:"",foto_url:""});
  const[saving,setSaving]=useState(false);
  const[fotoPreview,setFotoPreview]=useState(null);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  useEffect(()=>{if(item)setF({nombre:item.nombre||"",rol:item.rol||"sondista",telefono:item.telefono||"",email:item.email||"",foto_url:item.foto_url||""});else setF({nombre:"",rol:"sondista",telefono:"",email:"",foto_url:""});setFotoPreview(null);},[item,show]);
  const handleFoto=(e)=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=(ev)=>{setFotoPreview(ev.target.result);set("foto_url",ev.target.result);};r.readAsDataURL(file);};
  const handleSave=async()=>{if(!f.nombre)return;setSaving(true);const data={nombre:f.nombre,rol:f.rol,telefono:f.telefono||null,email:f.email||null,foto_url:f.foto_url||null,activo:true};if(item?.id)await sb.from("personal").update(data).eq("id",item.id);else await sb.from("personal").insert(data);setSaving(false);onSaved();};
  const preview=fotoPreview||f.foto_url;
  const initials=f.nombre.split(" ").map(n=>n[0]).slice(0,2).join("").toUpperCase()||"?";
  return(<Modal show={show} onClose={onClose} title={item?.id?"✏️ Editar empleado":"👷 Nuevo empleado"} footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={handleSave} disabled={saving||!f.nombre}>{saving?"Guardando...":"Guardar"}</Btn></div>}><div className="flex items-center gap-4 mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200"><div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-lg overflow-hidden shrink-0">{preview?<img src={preview} alt="Foto" className="w-full h-full object-cover"/>:initials}</div><div><p className="text-xs text-gray-500 mb-1">Foto de perfil</p><label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">📷 {preview?"Cambiar":"Subir foto"}<input type="file" accept="image/*" onChange={handleFoto} className="hidden"/></label></div></div><FL label="Nombre *"><Inp value={f.nombre} onChange={v=>set("nombre",v)} placeholder="Ej: Antonio García"/></FL><FL label="Rol *"><Sel value={f.rol} onChange={v=>set("rol",v)} options={[{value:"sondista",label:"Sondista"},{value:"ayudante",label:"Ayudante"},{value:"admin",label:"Administrador"}]}/></FL><div className="grid grid-cols-2 gap-3"><FL label="Teléfono"><Inp value={f.telefono} onChange={v=>set("telefono",v)} placeholder="654 123 456"/></FL><FL label="Email"><Inp value={f.email} onChange={v=>set("email",v)} placeholder="antonio@empresa.com"/></FL></div></Modal>);
}

function ModalObraAdmin({show,item,onClose,onSaved}){
  const[f,setF]=useState({numero_obra:"",tipo_via:"Calle",nombre_via:"",numero_via:"",info_adicional:"",cp:"",provincia:"",poblacion:"",latitud:"",longitud:"",estado:"sin_asignar"});
  const[saving,setSaving]=useState(false);
  const[geoLoading,setGeoLoading]=useState(false);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  useEffect(()=>{if(item)setF({numero_obra:item.numero_obra||"",tipo_via:item.tipo_via||"Calle",nombre_via:item.nombre_via||"",numero_via:item.numero_via||"",info_adicional:item.info_adicional||"",cp:item.cp||"",provincia:item.provincia||"",poblacion:item.poblacion||"",latitud:item.latitud||"",longitud:item.longitud||"",estado:item.estado||"sin_asignar"});else setF({numero_obra:"",tipo_via:"Calle",nombre_via:"",numero_via:"",info_adicional:"",cp:"",provincia:"",poblacion:"",latitud:"",longitud:"",estado:"sin_asignar"});},[item,show]);
  const handleCP=async(v)=>{set("cp",v);if(v.length===5){setGeoLoading(true);const geo=await geocodeCP(v);if(geo){set("provincia",geo.provincia);set("poblacion",geo.poblacion);set("latitud",geo.lat);set("longitud",geo.lon);}setGeoLoading(false);}};
  const handleSave=async()=>{if(!f.numero_obra)return;setSaving(true);const data={numero_obra:f.numero_obra,tipo_via:f.tipo_via,nombre_via:f.nombre_via,numero_via:f.numero_via,info_adicional:f.info_adicional,cp:f.cp,provincia:f.provincia,poblacion:f.poblacion,latitud:f.latitud||null,longitud:f.longitud||null,estado:f.estado};if(item?.id)await sb.from("obras").update(data).eq("id",item.id);else await sb.from("obras").insert(data);setSaving(false);onSaved();};
  return(<Modal show={show} onClose={onClose} wide title={item?.id?"✏️ Editar obra":"🏗 Nueva obra"} footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={handleSave} disabled={saving||!f.numero_obra}>{saving?"Guardando...":"Guardar"}</Btn></div>}><div className="grid grid-cols-2 gap-3"><FL label="Nº de obra *"><Inp value={f.numero_obra} onChange={v=>set("numero_obra",v)} placeholder="Ej: 1045"/></FL><FL label="Estado"><Sel value={f.estado} onChange={v=>set("estado",v)} options={Object.entries(ESTADOS).map(([k,v])=>({value:k,label:v}))}/></FL></div><div className="border-t border-gray-100 my-3 pt-3"><p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Dirección</p><div className="grid grid-cols-3 gap-2 mb-2"><Sel value={f.tipo_via} onChange={v=>set("tipo_via",v)} options={["Calle","Avenida","Carretera","Paseo","Plaza","Camino","Polígono"].map(x=>({value:x,label:x}))}/><div className="col-span-2"><Inp value={f.nombre_via} onChange={v=>set("nombre_via",v)} placeholder="Nombre de la vía"/></div></div><div className="grid grid-cols-2 gap-2 mb-2"><Inp value={f.numero_via} onChange={v=>set("numero_via",v)} placeholder="Nº / Km"/><Inp value={f.info_adicional} onChange={v=>set("info_adicional",v)} placeholder="Info adicional"/></div><div className="grid grid-cols-3 gap-2 mb-1"><div><Inp value={f.cp} onChange={handleCP} placeholder="C.P."/>{geoLoading&&<p className="text-xs text-teal-600 mt-1">⟳ Buscando...</p>}</div><Inp value={f.provincia} onChange={v=>set("provincia",v)} placeholder="Provincia"/><Inp value={f.poblacion} onChange={v=>set("poblacion",v)} placeholder="Población"/></div><div className="grid grid-cols-2 gap-2 mt-1"><Inp value={f.latitud} onChange={v=>set("latitud",v)} placeholder="Latitud"/><Inp value={f.longitud} onChange={v=>set("longitud",v)} placeholder="Longitud"/></div></div></Modal>);
}


// ── PANEL INVENTARIO ADMIN ────────────────────────────────────────────────────
function PanelInventarioAdmin({ onEditar, onRefresh }) {
  const [productos, setProductos] = useState([]);
  const [confirm, setConfirm] = useState(null);

  const load = () => sb.from("productos").select("*").order("nombre").then(({ data }) => setProductos(data || []));
  useEffect(() => { load(); }, []);

  const eliminar = async (id) => {
    await sb.from("productos").delete().eq("id", id);
    setConfirm(null); load(); onRefresh();
  };

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">Estos productos aparecerán en el formulario de Registro diario para que el equipo seleccione los consumibles utilizados cada día.</p>
      {productos.length === 0 && (
        <div className="text-center py-12 bg-white border border-dashed border-gray-300 rounded-2xl">
          <div className="text-3xl mb-2">📦</div>
          <p className="text-sm text-gray-500 mb-1">No hay productos todavía</p>
          <p className="text-xs text-gray-400">Pulsa "＋ Producto" arriba para añadir el primero</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {productos.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl">📦</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                  <p className="text-xs text-gray-500">Unidad: {p.unidad}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => onEditar(p)} className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">✏️</button>
                <button onClick={() => setConfirm({ id: p.id, nombre: p.nombre })} className="text-xs text-red-400 px-2 py-1 rounded border border-red-100 hover:bg-red-50">🗑</button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400">Precio referencia</span>
              <span className="text-sm font-medium text-teal-700">{parseFloat(p.precio_unitario || 0).toFixed(2)} €/{p.unidad}</span>
            </div>
            <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full border ${p.activo ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-gray-100 text-gray-500 border-gray-200"}`}>
              {p.activo ? "Activo" : "Inactivo"}
            </span>
          </div>
        ))}
      </div>
      <ConfirmDialog show={!!confirm} message={`¿Eliminar el producto "${confirm?.nombre}"?`} onConfirm={() => eliminar(confirm.id)} onCancel={() => setConfirm(null)} />
    </div>
  );
}

// ── MODAL PRODUCTO ────────────────────────────────────────────────────────────
function ModalProducto({ show, item, onClose, onSaved }) {
  const [f, setF] = useState({ nombre: "", unidad: "ud", precio_unitario: "", activo: true });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    if (item) setF({ nombre: item.nombre || "", unidad: item.unidad || "ud", precio_unitario: item.precio_unitario || "", activo: item.activo ?? true });
    else setF({ nombre: "", unidad: "ud", precio_unitario: "", activo: true });
  }, [item, show]);

  const handleSave = async () => {
    if (!f.nombre) return;
    setSaving(true);
    const data = { nombre: f.nombre, unidad: f.unidad, precio_unitario: parseFloat(f.precio_unitario) || 0, activo: f.activo };
    if (item?.id) await sb.from("productos").update(data).eq("id", item.id);
    else await sb.from("productos").insert(data);
    setSaving(false); onSaved();
  };

  const UNIDADES = ["ud", "ml", "l", "g", "kg", "m", "ml", "saco", "caja", "rollo", "litro", "garraf."];

  return (
    <Modal show={show} onClose={onClose} title={item?.id ? "✏️ Editar producto" : "📦 Nuevo producto"}
      footer={<div className="flex justify-end gap-2"><Btn variant="secondary" onClick={onClose}>Cancelar</Btn><Btn onClick={handleSave} disabled={saving || !f.nombre}>{saving ? "Guardando..." : "Guardar"}</Btn></div>}>
      <FL label="Nombre del producto *">
        <Inp value={f.nombre} onChange={v => set("nombre", v)} placeholder="Ej: Bentonita en polvo" />
      </FL>
      <div className="grid grid-cols-2 gap-3">
        <FL label="Unidad de medida *">
          <select value={f.unidad} onChange={e => set("unidad", e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/30">
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </FL>
        <FL label="Precio referencia (€)">
          <Inp type="number" value={f.precio_unitario} onChange={v => set("precio_unitario", v)} placeholder="0.00" />
        </FL>
      </div>
      <FL label="Estado">
        <Sel value={f.activo ? "true" : "false"} onChange={v => set("activo", v === "true")}
          options={[{ value: "true", label: "Activo — aparece en registros" }, { value: "false", label: "Inactivo — oculto en registros" }]} />
      </FL>
      <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-700">
        💡 El precio es orientativo. En cada registro diario el equipo puede ajustarlo si cambia.
      </div>
    </Modal>
  );
}

function PanelObrasAdmin({onRefresh}){
  const[obras,setObras]=useState([]);
  const[editando,setEditando]=useState(null);
  const[confirm,setConfirm]=useState(null);
  useEffect(()=>{sb.from("obras").select("*").order("numero_obra").then(({data})=>setObras(data||[]));},[]);
  const eliminar=async(id)=>{await sb.from("obras").delete().eq("id",id);setConfirm(null);setObras(o=>o.filter(x=>x.id!==id));onRefresh();};
  return(<div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{obras.map(o=>(<div key={o.id} className="bg-white border border-gray-200 rounded-2xl p-4"><div className="flex justify-between items-start mb-2"><span className="text-sm font-medium">Obra #{o.numero_obra}</span><div className="flex items-center gap-1"><Badge estado={o.estado}/><button onClick={()=>setEditando(o)} className="text-xs text-gray-400 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 ml-1">✏️</button><button onClick={()=>setConfirm({id:o.id,nombre:`Obra #${o.numero_obra}`})} className="text-xs text-red-400 px-2 py-1 rounded border border-red-100 hover:bg-red-50">🗑</button></div></div><p className="text-xs text-gray-500">📍 {[o.tipo_via,o.nombre_via,o.numero_via,o.poblacion].filter(Boolean).join(" ")||"Sin dirección"}</p></div>))}</div>{editando&&<ModalObraAdmin show item={editando} onClose={()=>setEditando(null)} onSaved={()=>{setEditando(null);sb.from("obras").select("*").order("numero_obra").then(({data})=>setObras(data||[]));onRefresh();}}/>}<ConfirmDialog show={!!confirm} message={`¿Eliminar "${confirm?.nombre}"?`} onConfirm={()=>eliminar(confirm.id)} onCancel={()=>setConfirm(null)}/></div>);
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App({ user, perfil, onLogout, onChangePassword }){
  const esAdmin = !perfil || perfil?.rol === "admin";
  const esSondista = perfil?.rol === "sondista";
  const[tab,setTab]=useState("gantt");
  const[adminSeccion,setAdminSeccion]=useState(null);
  const[camiones,setCamiones]=useState([]);
  const[personal,setPersonal]=useState([]);
  const[asignaciones,setAsignaciones]=useState([]);
  const[productos,setProductos]=useState([]);
  const[registros,setRegistros]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[showRegistro,setShowRegistro]=useState(false);
  const[detalle,setDetalle]=useState(null);
  const[asigEditar,setAsigEditar]=useState(null);
  const[showNP,setShowNP]=useState(false);
  const[confirm,setConfirm]=useState(null);

  const loadAll=useCallback(async()=>{
    setLoading(true);
    const[c,p,a,pr,r]=await Promise.all([
      sb.from("camiones").select("*").eq("activo",true).order("nombre"),
      sb.from("personal").select("*").eq("activo",true).order("nombre"),
      sb.from("asignaciones").select("*, obra:obras(*), camion:camiones(*), sondista:personal!asignaciones_sondista_id_fkey(*), ayudante:personal!asignaciones_ayudante_id_fkey(*)").order("fecha_inicio"),
      sb.from("productos").select("*").eq("activo",true).order("nombre"),
      sb.from("registros_diarios").select("*").order("fecha"),
    ]);
    setCamiones(c.data||[]);setPersonal(p.data||[]);setAsignaciones(a.data||[]);setProductos(pr.data||[]);setRegistros(r.data||[]);
    setLoading(false);
  },[]);

  useEffect(()=>{loadAll();},[loadAll]);

  const handleNP=async(razon,texto)=>{
    await sb.from("asignaciones").update({es_dia_no_productivo:true,np_razon:razon,np_texto_libre:texto||null}).eq("id",detalle.id);
    setShowNP(false);setDetalle(null);loadAll();
  };
  const handleQuitarNP=async()=>{
    await sb.from("asignaciones").update({es_dia_no_productivo:false,np_razon:null,np_texto_libre:null}).eq("id",detalle.id);
    setDetalle(null);loadAll();
  };
  const handleEliminar=async()=>{
    await sb.from("asignaciones").delete().eq("id",detalle.id);
    setConfirm(null);setDetalle(null);loadAll();
  };
  const goAdmin=(seccion)=>{setAdminSeccion(seccion);setTab("admin");};

  const allTabs=[
    {key:"gantt",label:"📊 Cronograma",roles:["admin","sondista","ayudante"]},
    {key:"kpis",label:"📈 KPIs",roles:["admin","sondista"]},
    {key:"obras",label:"🏗 Obras",roles:["admin","sondista"]},
    {key:"admin",label:"⚙️ Administración",roles:["admin"]},
  ];
  const tabs = allTabs.filter(t => !perfil || t.roles.includes(perfil.rol));

  return(
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2"><span className="text-xl">🗺</span><span className="font-medium text-gray-900 text-sm"><span className="text-teal-600">Sondeos</span>App</span></div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map(t=>(
              <button key={t.key} onClick={()=>{setTab(t.key);if(t.key!=="admin")setAdminSeccion(null);}}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${tab===t.key?"bg-white text-gray-800 shadow-sm":"text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors group relative"
            onClick={onChangePassword} title="Cambiar contraseña">
            <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center text-xs font-medium text-teal-700">
              {(user?.email||"?")[0].toUpperCase()}
            </div>
            <span className="text-xs text-gray-600 max-w-[120px] truncate">{user?.email}</span>
            {perfil?.rol && <span className="text-xs px-1.5 py-0.5 bg-white border border-gray-200 rounded-md text-gray-500 capitalize">{perfil.rol}</span>}
            <span className="text-xs text-gray-400 group-hover:text-teal-600 transition-colors">🔐</span>
          </div>
          {tab!=="admin" && (esAdmin || esSondista) && (
            <>
              <button onClick={()=>setShowRegistro(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-3 py-2 rounded-xl transition-colors">📋 Registro diario</button>
              {esAdmin && <button onClick={()=>setShowAdd(true)} className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">＋ Movimiento</button>}
            </>
          )}
          <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:bg-gray-50 rounded-xl transition-colors">
            🚪 Salir
          </button>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-5 max-w-screen-xl mx-auto">
        {loading
          ? <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Cargando datos...</div>
          : <>
            {tab==="gantt"&&<Gantt camiones={camiones} asignaciones={asignaciones} registros={registros} onBarClick={setDetalle}/>}
            {tab==="kpis"&&<PanelKPIs camiones={camiones} personal={personal} asignaciones={asignaciones} registros={registros} onGoAdmin={goAdmin}/>}
            {tab==="obras"&&<PanelObras asignaciones={asignaciones} productos={productos} registros={registros}/>}
            {tab==="admin"&&<PanelAdmin camiones={camiones} personal={personal} seccionInicial={adminSeccion} onRefresh={loadAll}/>}
          </>
        }
      </div>
      <ModalMovimiento show={showAdd||!!asigEditar} onClose={()=>{setShowAdd(false);setAsigEditar(null);}} camiones={camiones} personal={personal} onSaved={loadAll} asigEditar={asigEditar}/>
      <ModalRegistroDiario show={showRegistro} onClose={()=>setShowRegistro(false)} asignaciones={asignaciones} camiones={camiones} personal={personal} productos={productos} onSaved={loadAll}/>
      <ModalDetalle asig={detalle} onClose={()=>setDetalle(null)} onNP={()=>setShowNP(true)} onQuitarNP={handleQuitarNP} onEditar={()=>{setAsigEditar(detalle);setDetalle(null);}} onEliminar={()=>setConfirm(true)}/>
      <ModalNP show={showNP} onClose={()=>setShowNP(false)} onConfirm={handleNP}/>
      <ConfirmDialog show={!!confirm} message={`¿Eliminar el movimiento de la obra #${detalle?.obra?.numero_obra}?`} onConfirm={handleEliminar} onCancel={()=>setConfirm(null)}/>
    </div>
  );
}
