// Tipus per saber les dades del compte, el seu rol i si ja ha acabat de carregar la sessió.
// Només hi ha dos tipus de compte: client i administrador.
export type Rol = "client" | "admin";
// Dades del perfil que tenim a la col·lecció users.
export interface PerfilUsuario {
    name: string;
    phone: string;
    email: string;
    role: Rol;
    // El número canvia en assignar permisos per detectar sessions amb el rol anterior.
    roleVersion?: number;
}
// Dades del compte que necessiten les pantalles després del login.
export interface UsuarioSesion {
    uid: string;
    correo: string;
    correoVerificado: boolean;
    nombre: string;
    rol: Rol;
    versionRol: number;
}
// Ens indica si esperem Firebase, si hi ha un usuari o si ha fallat la càrrega.
export interface EstadoSesion {
    estado: "cargando" | "invitado" | "autenticado" | "error" | "desactivado";
    usuario: UsuarioSesion | null;
    perfil: PerfilUsuario | null;
    errorPerfil: boolean;
    mensaje: string;
}
