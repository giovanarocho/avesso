/* ==========================================================================
   CONFIGURAÇÃO DO CATÁLOGO — planilha do Google Sheets
   ==========================================================================
   Só uma coisa importa aqui: o ID da planilha (o trecho do link entre
   "/d/" e "/edit"). O site busca as abas pelo NOME ("identidade",
   "projetos", "capas", "config") — por isso é importante não renomear
   as abas na planilha.

   Enquanto o ID abaixo não estiver preenchido (ou se a planilha ficar
   fora do ar por qualquer motivo), o site continua funcionando
   normalmente com os projetos salvos em js/catalog-data.js.
   ========================================================================== */

const CATALOG_SHEET_ID = "1iUHZEiKuE9feaWxaX24j18z56s5-BKkW";

// só mexa aqui se algum dia precisar usar nomes de aba diferentes dos
// padrões (identidade / projetos / capas / config).
const CATALOG_TABS = {
  identidade: "identidade",
  projetos: "projetos",
  capas: "capas",
  config: "config"
};
