/*
 REGISTRO DE USO DE IA
 Herramienta usada: Claude
 Partes hechas con ayuda de la IA: estructura HTML, estilos, guardarDatos()/cargarDatos(),
   validaciones, agenda de turnos, historia clínica, búsqueda, exportar/importar,
   adaptación al celular (PWA): manifest.json, sw.js, íconos, aviso sin conexión,
   recordatorio por WhatsApp y enlaces tel:
 Partes que escribí o modifiqué yo: (completar: colores, mensajes, textos, etc.)
 Alumno/a: ... Curso: 6.º ... Fecha: ...
*/

"use strict";

/* ==========================================================
   1. DATOS Y localStorage
   Las relaciones se guardan con ids: duenoId, mascotaId, turnoId.
   (Se usa "dueno" sin ñ en el código para evitar problemas.)
   ========================================================== */
const CLAVE_DATOS = "veterinaria-datos";

let duenos = [];     // { id, nombre, telefono, email, direccion }
let mascotas = [];   // { id, duenoId, nombre, especie, raza, sexo, nacimiento, peso }
let turnos = [];     // { id, mascotaId, fecha, hora, motivo, veterinario, estado }
let consultas = [];  // { id, mascotaId, turnoId, fecha, peso, motivo, diagnostico, tratamiento, vacunas, proximoControl }

// Estado de edición de cada formulario (null = se está creando uno nuevo)
let idEditandoDueno = null;
let idEditandoMascota = null;
let idEditandoTurno = null;
let idEditandoConsulta = null;
let turnoParaConsulta = null;      // turno al que se vincula la consulta que se está cargando
let fechaAgenda = hoyISO();        // día que muestra la agenda

// JSON.stringify convierte los arrays en texto; JSON.parse hace el camino inverso.
function guardarDatos() {
  try {
    localStorage.setItem(CLAVE_DATOS, JSON.stringify({ duenos, mascotas, turnos, consultas }));
  } catch (error) {
    console.error(error);
    avisar("No se pudieron guardar los datos en este navegador.", "fallo");
  }
}

function cargarDatos() {
  try {
    const texto = localStorage.getItem(CLAVE_DATOS);
    if (texto === null) return;                       // primera vez: listas vacías
    const datos = JSON.parse(texto);
    duenos = Array.isArray(datos.duenos) ? datos.duenos : [];
    mascotas = Array.isArray(datos.mascotas) ? datos.mascotas : [];
    turnos = Array.isArray(datos.turnos) ? datos.turnos : [];
    consultas = Array.isArray(datos.consultas) ? datos.consultas : [];
  } catch (error) {
    console.error("No se pudieron leer los datos guardados:", error);
  }
}

/* ==========================================================
   2. UTILIDADES (fechas en hora local, textos, DOM)
   ========================================================== */
function $(id) { return document.getElementById(id); }

function nuevoId(prefijo) {
  return prefijo + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function dos(n) { return String(n).padStart(2, "0"); }

// Fecha local "AAAA-MM-DD" (no se usa toISOString porque trabaja en UTC y corre el día)
function aISO(fecha) {
  return fecha.getFullYear() + "-" + dos(fecha.getMonth() + 1) + "-" + dos(fecha.getDate());
}
function hoyISO() { return aISO(new Date()); }

// Devuelve {a, m, d} si el texto es una fecha real, o null
function partesFecha(iso) {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  if (!r) return null;
  const a = Number(r[1]), m = Number(r[2]), d = Number(r[3]);
  const f = new Date(a, m - 1, d);
  if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) return null;
  return { a, m, d };
}
function fechaValida(iso) { return partesFecha(iso) !== null; }
function aDate(iso) {
  const p = partesFecha(iso);
  return p ? new Date(p.a, p.m - 1, p.d) : null;
}
function sumarDias(iso, n) {
  const f = aDate(iso);
  f.setDate(f.getDate() + n);
  return aISO(f);
}
function formatoFecha(iso) {
  const p = partesFecha(iso);
  return p ? dos(p.d) + "/" + dos(p.m) + "/" + p.a : "";
}

// Edad como "2 años y 3 meses" o "5 meses". Compara año, mes y día por separado.
function edad(fechaNacimiento) {
  const p = partesFecha(fechaNacimiento);
  if (!p) return "";
  const hoy = new Date();
  let meses = (hoy.getFullYear() - p.a) * 12 + (hoy.getMonth() + 1 - p.m);
  if (hoy.getDate() < p.d) meses--;
  if (meses < 0) return "";                           // fecha futura
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anios === 0) {
    if (resto === 0) return "menos de 1 mes";
    return resto + (resto === 1 ? " mes" : " meses");
  }
  const textoAnios = anios + (anios === 1 ? " año" : " años");
  if (resto === 0) return textoAnios;
  return textoAnios + " y " + resto + (resto === 1 ? " mes" : " meses");
}

// Para comparar sin mayúsculas ni tildes
function normalizar(texto) {
  return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}
function soloDigitos(texto) { return String(texto || "").replace(/\D/g, ""); }

// El peso acepta coma o punto. Devuelve null (vacío), NaN (inválido) o un número.
function leerPeso(texto) {
  const t = String(texto || "").trim().replace(",", ".");
  if (t === "") return null;
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}
function textoPeso(peso) {
  return peso === null || peso === undefined || peso === "" ? "sin peso cargado" : String(peso).replace(".", ",") + " kg";
}

// Crear elementos con textContent (nunca innerHTML con datos del usuario)
function crear(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto !== undefined && texto !== null) e.textContent = texto;
  return e;
}
function boton(texto, clase, alHacerClic) {
  const b = crear("button", clase, texto);
  b.type = "button";
  b.addEventListener("click", alHacerClic);
  return b;
}

// Enlace (<a>) armado con textContent. Si nuevaPestana es true, se abre en otra pestaña de forma segura.
function enlace(texto, href, clase, nuevaPestana) {
  const a = crear("a", clase, texto);
  a.href = href;
  if (nuevaPestana) { a.target = "_blank"; a.rel = "noopener"; }
  return a;
}

// Teléfono para wa.me: solo números, con el prefijo de Argentina para celulares (549)
function telefonoWhatsApp(telefono) {
  const n = soloDigitos(telefono).replace(/^0+/, "");
  return n.startsWith("54") ? n : "549" + n;
}

const EMOJI_ESPECIE = { perro: "🐶", gato: "🐱", ave: "🐦", conejo: "🐰", otro: "🐾" };
function emojiEspecie(especie) { return EMOJI_ESPECIE[especie] || "🐾"; }

// Aviso flotante (reemplaza a alert)
let temporizadorAviso = null;
function avisar(texto, tipo, milisegundos) {
  const a = $("aviso");
  a.textContent = texto;
  a.className = "aviso " + (tipo || "info") + " visible";
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => a.classList.remove("visible"), milisegundos || 4500);
}

// Errores en rojo debajo de cada campo
function limpiarErrores(contenedor) {
  contenedor.querySelectorAll(".error").forEach(e => { e.textContent = ""; });
  contenedor.querySelectorAll(".invalido").forEach(c => c.classList.remove("invalido"));
}
// errores = { "id-del-campo": "mensaje" }. Devuelve true si hay errores.
function ponerErrores(errores) {
  const ids = Object.keys(errores);
  ids.forEach(id => {
    const aviso = document.querySelector('[data-error="' + id + '"]');
    if (aviso) aviso.textContent = errores[id];
    const campo = $(id);
    if (campo) campo.classList.add("invalido");
  });
  if (ids.length > 0) {
    const primero = $(ids[0]);
    if (primero) primero.focus();
  }
  return ids.length > 0;
}

/* ==========================================================
   3. NAVEGACIÓN
   ========================================================== */
function mostrarSeccion(idSeccion) {
  document.querySelectorAll(".seccion").forEach(s => s.classList.toggle("activa", s.id === idSeccion));
  document.querySelectorAll("#menu button").forEach(b => {
    const activo = b.dataset.seccion === idSeccion;
    b.classList.toggle("activo", activo);
    if (activo) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
  });
}

/* ==========================================================
   4. BÚSQUEDAS Y NOMBRES AUXILIARES
   ========================================================== */
function buscarDueno(id) { return duenos.find(d => d.id === id); }
function buscarMascota(id) { return mascotas.find(m => m.id === id); }
function nombreDueno(id) {
  const d = buscarDueno(id);
  return d ? d.nombre : "Sin dueño";
}
function nombreMascota(id) {
  const m = buscarMascota(id);
  return m ? m.nombre : "Mascota eliminada";
}
function porNombre(a, b) { return a.nombre.localeCompare(b.nombre, "es"); }

/* ==========================================================
   5. DUEÑOS
   ========================================================== */
function guardarDueno(evento) {
  evento.preventDefault();
  limpiarErrores($("form-dueno"));

  const nombre = $("d-nombre").value.trim();
  const telefono = $("d-telefono").value.trim();
  const email = $("d-email").value.trim();
  const direccion = $("d-direccion").value.trim();
  const errores = {};

  if (nombre === "") errores["d-nombre"] = "El nombre es obligatorio.";

  if (telefono === "") {
    errores["d-telefono"] = "El teléfono es obligatorio.";
  } else if (!/^[0-9 -]+$/.test(telefono) || soloDigitos(telefono) === "") {
    errores["d-telefono"] = "Solo números, espacios y guiones.";
  } else if (duenos.some(d => d.id !== idEditandoDueno && soloDigitos(d.telefono) === soloDigitos(telefono))) {
    errores["d-telefono"] = "Ya hay un dueño con ese teléfono.";
  }

  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errores["d-email"] = "El email no tiene un formato válido.";
  }

  if (ponerErrores(errores)) return;

  if (idEditandoDueno !== null) {
    const d = buscarDueno(idEditandoDueno);
    if (d) Object.assign(d, { nombre, telefono, email, direccion });
    avisar("Dueño actualizado.", "ok");
  } else {
    duenos.push({ id: nuevoId("du"), nombre, telefono, email, direccion });
    avisar("Dueño guardado.", "ok");
  }
  guardarDatos();
  cancelarEdicionDueno();
  renderTodo();
}

function cancelarEdicionDueno() {
  idEditandoDueno = null;
  $("form-dueno").reset();
  limpiarErrores($("form-dueno"));
  $("titulo-form-dueno").textContent = "Nuevo dueño";
  $("d-guardar").textContent = "Guardar dueño";
  $("d-cancelar").classList.add("oculto");
}

function editarDueno(id) {
  const d = buscarDueno(id);
  if (!d) return;
  idEditandoDueno = id;
  $("d-nombre").value = d.nombre;
  $("d-telefono").value = d.telefono;
  $("d-email").value = d.email || "";
  $("d-direccion").value = d.direccion || "";
  $("titulo-form-dueno").textContent = "Editar dueño";
  $("d-guardar").textContent = "Actualizar";
  $("d-cancelar").classList.remove("oculto");
  limpiarErrores($("form-dueno"));
  $("d-nombre").focus();
  $("form-dueno").scrollIntoView({ behavior: "smooth", block: "start" });
}

function borrarDueno(id) {
  const d = buscarDueno(id);
  if (!d) return;
  const cantidad = mascotas.filter(m => m.duenoId === id).length;
  if (cantidad > 0) {
    avisar("No se puede borrar a " + d.nombre + ": tiene " + cantidad + (cantidad === 1 ? " mascota." : " mascotas."), "fallo");
    return;
  }
  if (!confirm("¿Borrar al dueño " + d.nombre + "?")) return;
  duenos = duenos.filter(x => x.id !== id);
  if (idEditandoDueno === id) cancelarEdicionDueno();
  guardarDatos();
  renderTodo();
}

function mostrarDuenos() {
  const lista = $("lista-duenos");
  lista.replaceChildren();
  if (duenos.length === 0) {
    lista.append(crear("p", "vacio", "Todavía no hay dueños cargados."));
    return;
  }
  [...duenos].sort(porNombre).forEach(d => {
    const tarjeta = crear("article", "card-item");
    tarjeta.append(crear("h3", "", "👤 " + d.nombre));
    const lineaTelefono = crear("p");
    lineaTelefono.append("📞 ", enlace(d.telefono, "tel:" + soloDigitos(d.telefono), "enlace-tel"));
    tarjeta.append(lineaTelefono);
    if (d.email) tarjeta.append(crear("p", "", "✉️ " + d.email));
    if (d.direccion) tarjeta.append(crear("p", "", "🏠 " + d.direccion));

    const suyas = mascotas.filter(m => m.duenoId === d.id).sort(porNombre);
    tarjeta.append(crear("p", "", suyas.length > 0
      ? "🐾 Mascotas: " + suyas.map(m => emojiEspecie(m.especie) + " " + m.nombre).join(", ")
      : "🐾 Sin mascotas cargadas"));

    const acciones = crear("div", "acciones");
    acciones.append(boton("✏️ Editar", "btn secundario chico", () => editarDueno(d.id)));
    acciones.append(boton("🗑️ Borrar", "btn peligro chico", () => borrarDueno(d.id)));
    tarjeta.append(acciones);
    lista.append(tarjeta);
  });
}

/* ==========================================================
   6. MASCOTAS
   ========================================================== */
function guardarMascota(evento) {
  evento.preventDefault();
  limpiarErrores($("form-mascota"));

  const duenoId = $("m-dueno").value;
  const nombre = $("m-nombre").value.trim();
  const especie = $("m-especie").value;
  const raza = $("m-raza").value.trim();
  const sexo = $("m-sexo").value;
  const nacimiento = $("m-nacimiento").value;
  const peso = leerPeso($("m-peso").value);
  const errores = {};

  if (duenoId === "" || !buscarDueno(duenoId)) errores["m-dueno"] = "Elegí un dueño.";

  if (nombre === "") {
    errores["m-nombre"] = "El nombre es obligatorio.";
  } else if (mascotas.some(m => m.id !== idEditandoMascota && m.duenoId === duenoId &&
             normalizar(m.nombre) === normalizar(nombre))) {
    errores["m-nombre"] = "Ese dueño ya tiene una mascota con ese nombre.";
  }

  if (nacimiento === "" || !fechaValida(nacimiento)) {
    errores["m-nacimiento"] = "Ingresá una fecha de nacimiento válida.";
  } else if (nacimiento > hoyISO()) {
    errores["m-nacimiento"] = "La fecha de nacimiento no puede ser futura.";
  }

  if (Number.isNaN(peso) || (peso !== null && (peso < 0.1 || peso > 120))) {
    errores["m-peso"] = "El peso tiene que estar entre 0,1 y 120 kg.";
  }

  if (ponerErrores(errores)) return;

  if (idEditandoMascota !== null) {
    const m = buscarMascota(idEditandoMascota);
    if (m) Object.assign(m, { duenoId, nombre, especie, raza, sexo, nacimiento, peso });
    avisar("Mascota actualizada.", "ok");
  } else {
    mascotas.push({ id: nuevoId("ma"), duenoId, nombre, especie, raza, sexo, nacimiento, peso });
    avisar("Mascota guardada.", "ok");
  }
  guardarDatos();
  cancelarEdicionMascota();
  renderTodo();
}

function cancelarEdicionMascota() {
  idEditandoMascota = null;
  $("form-mascota").reset();
  limpiarErrores($("form-mascota"));
  $("titulo-form-mascota").textContent = "Nueva mascota";
  $("m-guardar").textContent = "Guardar mascota";
  $("m-cancelar").classList.add("oculto");
}

function editarMascota(id) {
  const m = buscarMascota(id);
  if (!m) return;
  idEditandoMascota = id;
  $("m-dueno").value = m.duenoId;
  $("m-nombre").value = m.nombre;
  $("m-especie").value = m.especie;
  $("m-raza").value = m.raza || "";
  $("m-sexo").value = m.sexo || "";
  $("m-nacimiento").value = m.nacimiento;
  $("m-peso").value = m.peso === null || m.peso === undefined ? "" : m.peso;
  $("titulo-form-mascota").textContent = "Editar mascota";
  $("m-guardar").textContent = "Actualizar";
  $("m-cancelar").classList.remove("oculto");
  limpiarErrores($("form-mascota"));
  $("m-nombre").focus();
  $("form-mascota").scrollIntoView({ behavior: "smooth", block: "start" });
}

function borrarMascota(id) {
  const m = buscarMascota(id);
  if (!m) return;
  const pendientes = turnos.filter(t => t.mascotaId === id && t.estado === "pendiente").length;
  if (pendientes > 0) {
    avisar("No se puede borrar a " + m.nombre + ": tiene " + pendientes +
           (pendientes === 1 ? " turno pendiente." : " turnos pendientes."), "fallo");
    return;
  }
  const cantConsultas = consultas.filter(c => c.mascotaId === id).length;
  let mensaje = "¿Borrar a " + m.nombre + "?";
  if (cantConsultas > 0) mensaje += " También se borrará su historia clínica (" + cantConsultas + " consulta/s).";
  if (!confirm(mensaje)) return;

  mascotas = mascotas.filter(x => x.id !== id);
  turnos = turnos.filter(t => t.mascotaId !== id);
  consultas = consultas.filter(c => c.mascotaId !== id);
  if (idEditandoMascota === id) cancelarEdicionMascota();
  guardarDatos();
  renderTodo();
}

function mostrarMascotas() {
  const lista = $("lista-mascotas");
  lista.replaceChildren();
  if (mascotas.length === 0) {
    lista.append(crear("p", "vacio", "Todavía no hay mascotas cargadas."));
    return;
  }
  [...mascotas].sort(porNombre).forEach(m => {
    const tarjeta = crear("article", "card-item card-mascota");
    tarjeta.append(crear("div", "emoji-especie", emojiEspecie(m.especie)));

    const info = crear("div");
    info.append(crear("h3", "", m.nombre));
    const detalle = [m.especie.charAt(0).toUpperCase() + m.especie.slice(1)];
    if (m.raza) detalle.push(m.raza);
    if (m.sexo) detalle.push(m.sexo);
    info.append(crear("p", "", detalle.join(" · ")));
    const e = edad(m.nacimiento);
    info.append(crear("p", "", "🎂 " + (e || "edad desconocida") + " · ⚖️ " + textoPeso(m.peso)));
    info.append(crear("p", "", "👤 " + nombreDueno(m.duenoId)));

    const acciones = crear("div", "acciones");
    acciones.append(boton("📋 Historia", "btn chico", () => abrirHistoria(m.id)));
    acciones.append(boton("✏️ Editar", "btn secundario chico", () => editarMascota(m.id)));
    acciones.append(boton("🗑️ Borrar", "btn peligro chico", () => borrarMascota(m.id)));
    info.append(acciones);

    tarjeta.append(info);
    lista.append(tarjeta);
  });
}

/* ==========================================================
   7. TURNOS Y AGENDA
   ========================================================== */
function aMinutos(hora) {
  const r = /^(\d{2}):(\d{2})$/.exec(hora || "");
  if (!r) return NaN;
  return Number(r[1]) * 60 + Number(r[2]);
}

function guardarTurno(evento) {
  evento.preventDefault();
  limpiarErrores($("form-turno"));

  const mascotaId = $("t-mascota").value;
  const fecha = $("t-fecha").value;
  const hora = $("t-hora").value;
  const motivo = $("t-motivo").value.trim();
  const veterinario = $("t-veterinario").value.trim();
  const errores = {};

  if (mascotaId === "" || !buscarMascota(mascotaId)) errores["t-mascota"] = "Elegí una mascota.";

  if (fecha === "" || !fechaValida(fecha)) {
    errores["t-fecha"] = "Ingresá una fecha válida.";
  } else if (fecha < hoyISO()) {
    errores["t-fecha"] = "La fecha no puede ser anterior a hoy.";
  }

  const minutos = aMinutos(hora);
  if (Number.isNaN(minutos)) {
    errores["t-hora"] = "Ingresá una hora.";
  } else if (minutos < 9 * 60 || minutos > 20 * 60) {
    errores["t-hora"] = "La hora tiene que estar entre las 9:00 y las 20:00.";
  }

  if (motivo === "") errores["t-motivo"] = "El motivo es obligatorio.";
  if (veterinario === "") errores["t-veterinario"] = "El veterinario es obligatorio.";

  // Superposición: misma fecha + hora + veterinario, ignorando los turnos cancelados
  if (!errores["t-fecha"] && !errores["t-hora"] && !errores["t-veterinario"]) {
    const ocupado = turnos.some(t =>
      t.id !== idEditandoTurno &&
      t.estado !== "cancelado" &&
      t.fecha === fecha &&
      aMinutos(t.hora) === minutos &&
      normalizar(t.veterinario) === normalizar(veterinario));
    if (ocupado) errores["t-hora"] = veterinario + " ya tiene un turno a esa fecha y hora.";
  }

  if (ponerErrores(errores)) return;

  if (idEditandoTurno !== null) {
    const t = turnos.find(x => x.id === idEditandoTurno);
    if (t) Object.assign(t, { mascotaId, fecha, hora, motivo, veterinario });
    avisar("Turno actualizado.", "ok");
  } else {
    turnos.push({ id: nuevoId("tu"), mascotaId, fecha, hora, motivo, veterinario, estado: "pendiente" });
    avisar("Turno asignado.", "ok");
  }
  fechaAgenda = fecha;                 // la agenda salta al día del turno para verlo
  guardarDatos();
  cancelarEdicionTurno();
  renderTodo();
}

function cancelarEdicionTurno() {
  idEditandoTurno = null;
  $("form-turno").reset();
  limpiarErrores($("form-turno"));
  $("titulo-form-turno").textContent = "Nuevo turno";
  $("t-guardar").textContent = "Dar turno";
  $("t-cancelar").classList.add("oculto");
}

function editarTurno(id) {
  const t = turnos.find(x => x.id === id);
  if (!t || t.estado !== "pendiente") return;
  idEditandoTurno = id;
  $("t-mascota").value = t.mascotaId;
  $("t-fecha").value = t.fecha;
  $("t-hora").value = t.hora;
  $("t-motivo").value = t.motivo;
  $("t-veterinario").value = t.veterinario;
  $("titulo-form-turno").textContent = "Editar turno";
  $("t-guardar").textContent = "Actualizar";
  $("t-cancelar").classList.remove("oculto");
  limpiarErrores($("form-turno"));
  $("t-fecha").focus();
  $("form-turno").scrollIntoView({ behavior: "smooth", block: "start" });
}

function cancelarTurno(id) {
  const t = turnos.find(x => x.id === id);
  if (!t || !confirm("¿Cancelar este turno?")) return;
  t.estado = "cancelado";
  if (idEditandoTurno === id) cancelarEdicionTurno();
  guardarDatos();
  renderTodo();
}

function borrarTurno(id) {
  if (!confirm("¿Borrar este turno de la agenda?")) return;
  turnos = turnos.filter(t => t.id !== id);
  if (idEditandoTurno === id) cancelarEdicionTurno();
  guardarDatos();
  renderTodo();
}

function marcarAtendido(id) {
  const t = turnos.find(x => x.id === id);
  if (!t) return;
  t.estado = "atendido";
  guardarDatos();
  renderTodo();
  abrirConsultaDeTurno(id);
}

function consultaDeTurno(turnoId) {
  return consultas.find(c => c.turnoId === turnoId);
}

function tituloDia(iso) {
  const f = aDate(iso);
  if (!f) return "";
  let texto = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(f);
  texto = texto.charAt(0).toUpperCase() + texto.slice(1);
  return iso === hoyISO() ? texto + " (hoy)" : texto;
}

function mostrarSemana() {
  const cont = $("semana");
  cont.replaceChildren();
  const f = aDate(fechaAgenda);
  const lunes = sumarDias(fechaAgenda, -((f.getDay() + 6) % 7));
  const hoy = hoyISO();
  for (let i = 0; i < 7; i++) {
    const dia = sumarDias(lunes, i);
    const cantidad = turnos.filter(t => t.fecha === dia && t.estado !== "cancelado").length;
    const nombreDia = new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(aDate(dia)).replace(".", "");
    const b = crear("button", "dia-semana" + (dia === fechaAgenda ? " seleccionado" : "") + (dia === hoy ? " hoy" : ""));
    b.type = "button";
    b.setAttribute("aria-label", tituloDia(dia) + ": " + cantidad + " turnos");
    b.append(crear("span", "", nombreDia), crear("strong", "", String(aDate(dia).getDate())),
             crear("span", "cantidad" + (cantidad === 0 ? " cero" : ""), String(cantidad)));
    b.addEventListener("click", () => { fechaAgenda = dia; mostrarAgenda(); });
    cont.append(b);
  }
}

function mostrarAgenda() {
  $("agenda-fecha").value = fechaAgenda;
  $("agenda-titulo").textContent = tituloDia(fechaAgenda);
  mostrarSemana();

  const lista = $("agenda");
  lista.replaceChildren();
  const delDia = turnos.filter(t => t.fecha === fechaAgenda).sort((a, b) => aMinutos(a.hora) - aMinutos(b.hora));
  if (delDia.length === 0) {
    lista.append(crear("p", "vacio", "No hay turnos para este día."));
    return;
  }

  delDia.forEach(t => {
    const m = buscarMascota(t.mascotaId);
    const tarjeta = crear("article", "card-item turno" + (t.estado === "cancelado" ? " cancelado" : ""));
    tarjeta.append(crear("div", "hora", t.hora));

    const info = crear("div");
    const titulo = crear("h3", "", (m ? emojiEspecie(m.especie) : "🐾") + " " + nombreMascota(t.mascotaId));
    titulo.append(crear("span", "etiqueta " + t.estado, t.estado));
    info.append(titulo);
    info.append(crear("p", "", "👤 " + (m ? nombreDueno(m.duenoId) : "Sin dueño")));
    info.append(crear("p", "", "📝 " + t.motivo + " · 🩺 " + t.veterinario));

    const acciones = crear("div", "acciones");
    if (t.estado === "pendiente") {
      acciones.append(boton("✅ Atendido", "btn chico", () => marcarAtendido(t.id)));
      acciones.append(boton("📋 Historia", "btn secundario chico", () => abrirHistoria(t.mascotaId)));

      // Funciones del celular: recordar el turno por WhatsApp y llamar al dueño
      const duenoDelTurno = m ? buscarDueno(m.duenoId) : null;
      if (duenoDelTurno && soloDigitos(duenoDelTurno.telefono) !== "") {
        const mensaje = "Hola " + duenoDelTurno.nombre + ", te recordamos el turno de " + m.nombre +
                        " el " + formatoFecha(t.fecha) + " a las " + t.hora + " en Veterinaria Patitas. ¡Los esperamos! 🐾";
        acciones.append(enlace("📲 Recordar por WhatsApp",
          "https://wa.me/" + telefonoWhatsApp(duenoDelTurno.telefono) + "?text=" + encodeURIComponent(mensaje),
          "btn chico", true));
        acciones.append(enlace("📞 Llamar", "tel:" + soloDigitos(duenoDelTurno.telefono), "btn secundario chico"));
      }

      acciones.append(boton("✏️ Editar", "btn secundario chico", () => editarTurno(t.id)));
      acciones.append(boton("🚫 Cancelar", "btn peligro chico", () => cancelarTurno(t.id)));
    } else if (t.estado === "atendido") {
      if (consultaDeTurno(t.id)) {
        acciones.append(boton("📋 Ver historia", "btn secundario chico", () => abrirHistoria(t.mascotaId)));
      } else {
        acciones.append(boton("📝 Cargar consulta", "btn chico", () => abrirConsultaDeTurno(t.id)));
      }
    } else {
      acciones.append(boton("🗑️ Borrar", "btn peligro chico", () => borrarTurno(t.id)));
    }
    info.append(acciones);
    tarjeta.append(info);
    lista.append(tarjeta);
  });
}

/* ==========================================================
   8. HISTORIA CLÍNICA
   ========================================================== */
function limpiarFormConsulta() {
  idEditandoConsulta = null;
  turnoParaConsulta = null;
  $("form-consulta").reset();
  limpiarErrores($("seccion-historias"));
  $("c-fecha").value = hoyISO();
  $("c-turno-info").textContent = "";
  $("titulo-form-consulta").textContent = "Nueva consulta";
  $("c-guardar").textContent = "Guardar consulta";
  $("c-cancelar").classList.add("oculto");
}

function abrirHistoria(mascotaId) {
  if (idEditandoConsulta !== null || turnoParaConsulta !== null) limpiarFormConsulta();
  mostrarSeccion("seccion-historias");
  $("h-mascota").value = mascotaId;
  mostrarHistoria();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Abre el formulario de consulta con la mascota y el turno ya elegidos
function abrirConsultaDeTurno(turnoId) {
  const t = turnos.find(x => x.id === turnoId);
  if (!t) return;
  if (consultaDeTurno(turnoId)) {
    avisar("Ese turno ya tiene su consulta cargada.", "info");
    abrirHistoria(t.mascotaId);
    return;
  }
  limpiarFormConsulta();
  turnoParaConsulta = turnoId;
  mostrarSeccion("seccion-historias");
  $("h-mascota").value = t.mascotaId;
  const m = buscarMascota(t.mascotaId);
  $("c-motivo").value = t.motivo;
  if (m && m.peso !== null && m.peso !== undefined) $("c-peso").value = m.peso;
  $("c-turno-info").textContent = "🔗 Consulta del turno del " + formatoFecha(t.fecha) + " a las " + t.hora + " (" + t.motivo + ")";
  mostrarHistoria();
  $("c-peso").focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function ultimaConsulta(mascotaId) {
  let mejor = null;
  consultas.forEach(c => {
    if (c.mascotaId === mascotaId && (mejor === null || c.fecha >= mejor.fecha)) mejor = c;
  });
  return mejor;
}

// El peso de la mascota es el de su consulta más reciente
function sincronizarPeso(mascotaId) {
  const m = buscarMascota(mascotaId);
  const c = ultimaConsulta(mascotaId);
  if (m && c && typeof c.peso === "number") m.peso = c.peso;
}

function guardarConsulta(evento) {
  evento.preventDefault();
  limpiarErrores($("seccion-historias"));

  const mascotaId = $("h-mascota").value;
  const fecha = $("c-fecha").value;
  const peso = leerPeso($("c-peso").value);
  const motivo = $("c-motivo").value.trim();
  const diagnostico = $("c-diagnostico").value.trim();
  const tratamiento = $("c-tratamiento").value.trim();
  const vacunas = $("c-vacunas").value.trim();
  const proximoControl = $("c-proximo").value;
  const errores = {};

  if (mascotaId === "" || !buscarMascota(mascotaId)) errores["h-mascota"] = "Elegí una mascota.";

  if (fecha === "" || !fechaValida(fecha)) {
    errores["c-fecha"] = "Ingresá una fecha válida.";
  } else if (fecha > hoyISO()) {
    errores["c-fecha"] = "La fecha de la consulta no puede ser futura.";
  }

  if (peso === null) errores["c-peso"] = "El peso es obligatorio.";
  else if (Number.isNaN(peso) || peso < 0.1 || peso > 120) errores["c-peso"] = "El peso tiene que estar entre 0,1 y 120 kg.";

  if (motivo === "") errores["c-motivo"] = "El motivo es obligatorio.";
  if (diagnostico === "") errores["c-diagnostico"] = "El diagnóstico es obligatorio.";
  if (tratamiento === "") errores["c-tratamiento"] = "El tratamiento es obligatorio.";

  if (proximoControl !== "") {
    if (!fechaValida(proximoControl)) errores["c-proximo"] = "Ingresá una fecha válida.";
    else if (!errores["c-fecha"] && proximoControl < fecha) errores["c-proximo"] = "No puede ser anterior a la consulta.";
  }

  // Un turno solo puede generar una consulta
  if (turnoParaConsulta !== null &&
      consultas.some(c => c.turnoId === turnoParaConsulta && c.id !== idEditandoConsulta)) {
    errores["h-mascota"] = "Ese turno ya tiene una consulta cargada.";
  }

  if (ponerErrores(errores)) return;

  if (idEditandoConsulta !== null) {
    const c = consultas.find(x => x.id === idEditandoConsulta);
    if (c) Object.assign(c, { mascotaId, fecha, peso, motivo, diagnostico, tratamiento, vacunas, proximoControl });
    avisar("Consulta actualizada.", "ok");
  } else {
    consultas.push({ id: nuevoId("co"), mascotaId, turnoId: turnoParaConsulta, fecha, peso, motivo,
                     diagnostico, tratamiento, vacunas, proximoControl });
    avisar("Consulta guardada en la historia clínica.", "ok");
  }
  sincronizarPeso(mascotaId);
  guardarDatos();
  limpiarFormConsulta();
  renderTodo();
}

function editarConsulta(id) {
  const c = consultas.find(x => x.id === id);
  if (!c) return;
  idEditandoConsulta = id;
  turnoParaConsulta = c.turnoId || null;
  $("h-mascota").value = c.mascotaId;
  $("c-fecha").value = c.fecha;
  $("c-peso").value = c.peso;
  $("c-motivo").value = c.motivo;
  $("c-diagnostico").value = c.diagnostico;
  $("c-tratamiento").value = c.tratamiento;
  $("c-vacunas").value = c.vacunas || "";
  $("c-proximo").value = c.proximoControl || "";
  const t = turnos.find(x => x.id === c.turnoId);
  $("c-turno-info").textContent = t ? "🔗 Consulta del turno del " + formatoFecha(t.fecha) + " a las " + t.hora : "";
  $("titulo-form-consulta").textContent = "Editar consulta";
  $("c-guardar").textContent = "Actualizar";
  $("c-cancelar").classList.remove("oculto");
  limpiarErrores($("seccion-historias"));
  $("form-consulta").scrollIntoView({ behavior: "smooth", block: "start" });
}

function borrarConsulta(id) {
  const c = consultas.find(x => x.id === id);
  if (!c || !confirm("¿Borrar esta consulta de la historia clínica?")) return;
  consultas = consultas.filter(x => x.id !== id);
  if (idEditandoConsulta === id) limpiarFormConsulta();
  sincronizarPeso(c.mascotaId);
  guardarDatos();
  renderTodo();
}

function mostrarHistoria() {
  const cont = $("linea-tiempo");
  cont.replaceChildren();
  const id = $("h-mascota").value;
  const m = buscarMascota(id);
  if (!m) {
    cont.append(crear("p", "vacio", "Elegí una mascota para ver su historia clínica."));
    return;
  }

  const ficha = crear("div", "tarjeta ficha-mascota");
  ficha.append(crear("div", "emoji-especie", emojiEspecie(m.especie)));
  const datos = crear("div");
  datos.append(crear("h3", "", m.nombre));
  datos.append(crear("p", "", "🎂 " + (edad(m.nacimiento) || "edad desconocida") + " · ⚖️ " + textoPeso(m.peso)));
  const d = buscarDueno(m.duenoId);
  const lineaDueno = crear("p");
  if (d) lineaDueno.append("👤 " + d.nombre + " · 📞 ", enlace(d.telefono, "tel:" + soloDigitos(d.telefono), "enlace-tel"));
  else lineaDueno.append("👤 Sin dueño");
  datos.append(lineaDueno);
  ficha.append(datos);
  cont.append(ficha);

  // De la más nueva a la más vieja (si coincide la fecha, la cargada después va primero)
  const suyas = consultas
    .map((c, indice) => ({ c, indice }))
    .filter(x => x.c.mascotaId === id)
    .sort((a, b) => (a.c.fecha < b.c.fecha ? 1 : a.c.fecha > b.c.fecha ? -1 : b.indice - a.indice))
    .map(x => x.c);

  if (suyas.length === 0) {
    cont.append(crear("p", "vacio", "Esta mascota todavía no tiene consultas."));
    return;
  }

  const linea = crear("div", "linea-tiempo");
  const hoy = hoyISO();
  suyas.forEach((c, posicion) => {
    const item = crear("article", "card-item consulta");
    item.append(crear("div", "fecha", formatoFecha(c.fecha)));
    item.append(crear("p", "", "📝 Motivo: " + c.motivo));
    item.append(crear("p", "", "🩺 Diagnóstico: " + c.diagnostico));
    item.append(crear("p", "", "💊 Tratamiento: " + c.tratamiento));
    if (c.vacunas) item.append(crear("p", "", "💉 Vacunas: " + c.vacunas));
    item.append(crear("p", "", "⚖️ Peso: " + textoPeso(c.peso)));

    if (c.proximoControl) {
      item.append(crear("p", "", "📅 Próximo control: " + formatoFecha(c.proximoControl)));
      if (posicion === 0 && c.proximoControl < hoy) {
        item.append(crear("div", "alerta-control", "⚠️ El próximo control ya venció"));
      }
    }

    const acciones = crear("div", "acciones");
    acciones.append(boton("✏️ Editar", "btn secundario chico", () => editarConsulta(c.id)));
    acciones.append(boton("🗑️ Borrar", "btn peligro chico", () => borrarConsulta(c.id)));
    item.append(acciones);
    linea.append(item);
  });
  cont.append(linea);
}

/* ==========================================================
   9. BUSCADOR GENERAL (mascota o dueño, sin mayúsculas ni tildes)
   ========================================================== */
function buscarGeneral() {
  const consulta = normalizar($("buscador").value);
  const cont = $("resultados-busqueda");
  cont.replaceChildren();
  if (consulta === "") {
    cont.classList.add("oculto");
    return;
  }
  cont.classList.remove("oculto");

  const encontradas = mascotas
    .filter(m => normalizar(m.nombre).includes(consulta) || normalizar(nombreDueno(m.duenoId)).includes(consulta))
    .sort(porNombre);

  cont.append(crear("h3", "", "Resultados (" + encontradas.length + ")"));
  if (encontradas.length === 0) {
    cont.append(crear("p", "", "No se encontraron mascotas ni dueños con ese nombre."));
    return;
  }
  encontradas.forEach(m => {
    const b = crear("button", "resultado-item");
    b.type = "button";
    b.append(crear("span", "", emojiEspecie(m.especie)),
             crear("span", "", m.nombre + " · dueño/a: " + nombreDueno(m.duenoId) + " · abrir historia →"));
    b.addEventListener("click", () => {
      $("buscador").value = "";
      buscarGeneral();
      abrirHistoria(m.id);
    });
    cont.append(b);
  });
}

/* ==========================================================
   10. EXPORTAR E IMPORTAR JSON
   ========================================================== */
async function exportarDatos() {
  const datos = { duenos, mascotas, turnos, consultas };
  const texto = JSON.stringify(datos, null, 2);

  // En los celulares que lo permiten, se ofrece compartir el archivo (correo, Drive, WhatsApp…)
  try {
    const archivo = new File([texto], "veterinaria.json", { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: "Veterinaria Patitas" });
      avisar("Datos compartidos.", "ok");
      return;
    }
  } catch (error) {
    if (error && error.name === "AbortError") return;           // la persona cerró el menú de compartir
    console.error(error);                                         // si falla, se descarga como siempre
  }

  const blob = new Blob([texto], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = "veterinaria.json";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
  avisar("Se descargó veterinaria.json", "ok");
}

function importarDatos(evento) {
  const entrada = evento.target;
  const archivo = entrada.files[0];
  if (!archivo) return;

  const lector = new FileReader();
  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);                  // si no es JSON, salta al catch
      const nombres = ["duenos", "mascotas", "turnos", "consultas"];
      nombres.forEach(n => {
        if (datos === null || typeof datos !== "object" || !Array.isArray(datos[n])) {
          throw new Error("falta la lista «" + n + "»");
        }
        if (!datos[n].every(x => x !== null && typeof x === "object" && x.id !== undefined)) {
          throw new Error("la lista «" + n + "» tiene registros inválidos");
        }
      });

      if (!confirm("Esto reemplaza todos los datos actuales por los del archivo. ¿Continuar?")) return;

      duenos = datos.duenos;
      mascotas = datos.mascotas;
      turnos = datos.turnos;
      consultas = datos.consultas;
      guardarDatos();
      cancelarEdicionDueno();
      cancelarEdicionMascota();
      cancelarEdicionTurno();
      limpiarFormConsulta();
      renderTodo();
      avisar("Datos importados correctamente.", "ok");
    } catch (error) {
      console.error(error);
      avisar("No se pudo importar: el archivo no es válido (" + error.message + "). No se cambió nada.", "fallo");
    } finally {
      entrada.value = "";                                       // permite elegir el mismo archivo otra vez
    }
  };
  lector.onerror = () => {
    avisar("No se pudo leer el archivo.", "fallo");
    entrada.value = "";
  };
  lector.readAsText(archivo);
}

/* ==========================================================
   11. DATOS DE EJEMPLO (todos ficticios)
   ========================================================== */
function cargarEjemplo() {
  const hoy = hoyISO();
  duenos = [
    { id: "du-ej1", nombre: "Marta Ejemplo", telefono: "11 5555-0303", email: "marta@ejemplo.com", direccion: "Calle Falsa 123" },
    { id: "du-ej2", nombre: "Lucas Inventado", telefono: "11 5555-0404", email: "", direccion: "" }
  ];
  mascotas = [
    { id: "ma-ej1", duenoId: "du-ej1", nombre: "Firulais", especie: "perro", raza: "Mestizo", sexo: "macho", nacimiento: "2021-03-15", peso: 14.2 },
    { id: "ma-ej2", duenoId: "du-ej1", nombre: "Michi", especie: "gato", raza: "Común europeo", sexo: "hembra", nacimiento: "2023-08-02", peso: 4.1 },
    { id: "ma-ej3", duenoId: "du-ej2", nombre: "Piolín", especie: "ave", raza: "Canario", sexo: "", nacimiento: "2024-05-20", peso: 0.3 }
  ];
  turnos = [
    { id: "tu-ej1", mascotaId: "ma-ej1", fecha: hoy, hora: "17:30", motivo: "Vacuna", veterinario: "Dra. Ficticia", estado: "pendiente" },
    { id: "tu-ej2", mascotaId: "ma-ej3", fecha: hoy, hora: "18:15", motivo: "Control", veterinario: "Dra. Ficticia", estado: "pendiente" },
    { id: "tu-ej3", mascotaId: "ma-ej2", fecha: sumarDias(hoy, 1), hora: "10:00", motivo: "Castración", veterinario: "Dr. Imaginario", estado: "pendiente" }
  ];
  consultas = [
    { id: "co-ej1", mascotaId: "ma-ej2", turnoId: null, fecha: sumarDias(hoy, -400), peso: 3.6, motivo: "Control anual",
      diagnostico: "Sana", tratamiento: "Desparasitación", vacunas: "Triple felina", proximoControl: sumarDias(hoy, -35) },
    { id: "co-ej2", mascotaId: "ma-ej1", turnoId: null, fecha: sumarDias(hoy, -60), peso: 14.2, motivo: "Picazón en la piel",
      diagnostico: "Dermatitis leve", tratamiento: "Shampoo medicado cada 3 días", vacunas: "", proximoControl: sumarDias(hoy, 30) }
  ];
  guardarDatos();
  renderTodo();
  avisar("Se cargaron datos de ejemplo ficticios.", "ok");
}

/* ==========================================================
   12. DIBUJAR TODO Y ARRANQUE
   ========================================================== */
function llenarSelectDuenos(select) {
  const actual = select.value;
  select.replaceChildren(new Option("Elegí un dueño…", ""));
  [...duenos].sort(porNombre).forEach(d => select.add(new Option(d.nombre, d.id)));
  if ([...select.options].some(o => o.value === actual)) select.value = actual;
}

function llenarSelectMascotas(select) {
  const actual = select.value;
  select.replaceChildren(new Option("Elegí una mascota…", ""));
  [...mascotas].sort(porNombre).forEach(m =>
    select.add(new Option(m.nombre + " (" + nombreDueno(m.duenoId) + ")", m.id)));
  if ([...select.options].some(o => o.value === actual)) select.value = actual;
}

function renderTodo() {
  llenarSelectDuenos($("m-dueno"));
  llenarSelectMascotas($("t-mascota"));
  llenarSelectMascotas($("h-mascota"));
  mostrarDuenos();
  mostrarMascotas();
  mostrarAgenda();
  mostrarHistoria();
  const vacia = duenos.length + mascotas.length + turnos.length + consultas.length === 0;
  $("bloque-ejemplo").classList.toggle("oculto", !vacia);
  buscarGeneral();
}

function iniciar() {
  cargarDatos();

  document.querySelectorAll("#menu button").forEach(b =>
    b.addEventListener("click", () => mostrarSeccion(b.dataset.seccion)));

  $("form-dueno").addEventListener("submit", guardarDueno);
  $("d-cancelar").addEventListener("click", cancelarEdicionDueno);
  $("form-mascota").addEventListener("submit", guardarMascota);
  $("m-cancelar").addEventListener("click", cancelarEdicionMascota);
  $("form-turno").addEventListener("submit", guardarTurno);
  $("t-cancelar").addEventListener("click", cancelarEdicionTurno);
  $("form-consulta").addEventListener("submit", guardarConsulta);
  $("c-cancelar").addEventListener("click", limpiarFormConsulta);

  // Agenda: hoy, día anterior/siguiente y selector de fecha
  $("agenda-hoy").addEventListener("click", () => { fechaAgenda = hoyISO(); mostrarAgenda(); });
  $("agenda-anterior").addEventListener("click", () => { fechaAgenda = sumarDias(fechaAgenda, -1); mostrarAgenda(); });
  $("agenda-siguiente").addEventListener("click", () => { fechaAgenda = sumarDias(fechaAgenda, 1); mostrarAgenda(); });
  $("agenda-fecha").addEventListener("change", () => {
    if (fechaValida($("agenda-fecha").value)) fechaAgenda = $("agenda-fecha").value;
    mostrarAgenda();
  });

  // Al cambiar de mascota en Historias se descarta una consulta a medio cargar
  $("h-mascota").addEventListener("change", () => {
    const t = turnos.find(x => x.id === turnoParaConsulta);
    if (idEditandoConsulta !== null || (t && t.mascotaId !== $("h-mascota").value)) limpiarFormConsulta();
    mostrarHistoria();
  });

  $("buscador").addEventListener("input", buscarGeneral);
  $("btn-exportar").addEventListener("click", exportarDatos);
  $("btn-importar").addEventListener("click", () => $("archivo-importar").click());
  $("archivo-importar").addEventListener("change", importarDatos);
  $("btn-ejemplo").addEventListener("click", cargarEjemplo);

  $("c-fecha").value = hoyISO();
  renderTodo();
  mostrarSeccion("seccion-turnos");          // en el celular, lo primero es la agenda de turnos del día

  actualizarEstadoConexion();
  window.addEventListener("online", actualizarEstadoConexion);
  window.addEventListener("offline", actualizarEstadoConexion);
}

/* ==========================================================
   13. SIN CONEXIÓN Y SERVICE WORKER (Práctico 11)
   ========================================================== */
// Aviso discreto arriba cuando el dispositivo pierde internet
function actualizarEstadoConexion() {
  $("aviso-offline").classList.toggle("oculto", navigator.onLine);
}

// El service worker (sw.js) guarda una copia de la app para usarla sin internet.
// Solo se registra si el navegador lo admite y la página está en https (o en localhost).
function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const esLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if (location.protocol !== "https:" && !esLocal) return;     // con file:// no funciona

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then(registro => {
      // Si se publicó una versión nueva, se avisa cuando termina de instalarse
      registro.addEventListener("updatefound", () => {
        const nuevo = registro.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
            avisar("Hay una versión nueva: cerrá y volvé a abrir la app", "ok", 15000);
          }
        });
      });
    }).catch(error => console.error("No se pudo registrar el service worker:", error));
  });
}

iniciar();
registrarServiceWorker();
