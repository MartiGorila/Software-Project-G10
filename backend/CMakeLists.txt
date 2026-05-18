Resumen
=======
Este documento muestra los archivos mínimos y comandos necesarios para comprobar de forma muy básica que el `backend` se configura, compila y ejecuta usando CMake y CTest.

Requisitos del runner
---------------------
- `cmake` (>= 3.16 recomendado)
- `g++` (o cualquier compilador de C++ compatible)

Estructura mínima de archivos
-----------------------------
backend/
  CMakeLists.txt      <- archivo CMake principal (contenido de ejemplo abajo)
  src/
    main.cpp          <- ejecutable de prueba (ejemplo abajo)

Contenido sugerido para `backend/CMakeLists.txt`:
-------------------------------------------------
cmake_minimum_required(VERSION 3.16)
project(backend_project VERSION 0.1 LANGUAGES CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Ejecutable mínimo
add_executable(backend_exec src/main.cpp)

# Habilitar tests con CTest
enable_testing()
add_test(NAME basic_run COMMAND backend_exec)

Contenido sugerido para `backend/src/main.cpp`:
------------------------------------------------
#include <iostream>
int main() {
  std::cout << "Hello from backend!\n";
  return 0;
}

Comandos para comprobar localmente (desde la raíz del repo):
-----------------------------------------------------------
cmake -S backend -B backend/build
cmake --build backend/build
cd backend/build
ctest --output-on-failure

Notas y recomendaciones
-----------------------
- La CI que ya existe en `.github/workflows/ci.yml` instala `cmake` y `g++`, y ejecuta estos comandos.
- Si tu proyecto backend ya tiene otros ficheros fuente y tests, adapta `add_executable` y `add_test` según corresponda.
- Para una verificación todavía más básica, basta con los archivos anteriores: CMake configurará el proyecto, compilación generará `backend_exec` y `ctest` ejecutará el test `basic_run` que simplemente imprime un mensaje y devuelve 0 (éxito).

Si quieres, puedo crear automáticamente `backend/CMakeLists.txt` y `backend/src/main.cpp` con el contenido de ejemplo para que la CI tenga algo que compilar de inmediato. ¿Lo añado?