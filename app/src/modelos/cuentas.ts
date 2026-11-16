// Tipus per saber les dades del compte, el seu rol i si ja ha acabat de carregar la sessió.
// Només hi ha dos tipus de compte: client i administrador.
export type Rol = "client" | "admin";
// Dades del perfil que tenim a la col·lecció users.
export interface PerfilUsuario {
    name: string;
    phone: string;
    // Correu associat al compte; aquest formulari de contacte no el modifica.
    email: string;
    role: Rol;
    // El número canvia en assignar permisos per detectar sessions amb el rol anterior.
    roleVersion?: number;
}
// Dades del compte que necessiten les pantalles després del login.
export interface UsuarioSesion {
    uid: string;
    correo: string;
    // Indica si Auth ha confirmat la verificació del correu del compte actual.
    correoVerificado: boolean;
    nombre: string;
    rol: Rol;
    // Versió dels permisos que la sessió ha carregat del token.
    versionRol: number;
}
// Ens indica si esperem Firebase, si hi ha un usuari o si ha fallat la càrrega.
export interface EstadoSesion {
    estado: "cargando" | "invitado" | "autenticado" | "error" | "desactivado";
    usuario: UsuarioSesion | null;
    perfil: PerfilUsuario | null;
    // Permet mostrar que el compte ha entrat però la lectura del seu contacte ha fallat.
    errorPerfil: boolean;
    // Text d’estat que poden presentar el menú o els formularis.
    mensaje: string;
}
