/**
 * Enregistre individuellement les 4 commandes sur un seul serveur Discord.
 * N'efface pas les commandes d'autres applications ni les anciennes commandes.
 * Usage (dans un terminal local, jamais dans le navigateur ou un salon Discord) :
 *   DISCORD_APPLICATION_ID=... DISCORD_GUILD_ID=... DISCORD_BOT_TOKEN=... node discord-bot/scripts/register-commands.mjs
 */
const appId=process.env.DISCORD_APPLICATION_ID?.trim();
const guildId=process.env.DISCORD_GUILD_ID?.trim();
const botToken=process.env.DISCORD_BOT_TOKEN?.trim();
const looksLikeId=v=>/^\d{17,22}$/.test(v||"");
if(!looksLikeId(appId)||!looksLikeId(guildId)||!botToken){
 console.error("Il manque DISCORD_APPLICATION_ID, DISCORD_GUILD_ID ou DISCORD_BOT_TOKEN dans l'environnement local.");
 process.exitCode=1;
}else{
 const commands=[
  {name:"aide",description:"Découvrir les commandes et le fonctionnement de Bon Point"},
  {name:"site",description:"Obtenir le lien du site officiel Bon Point"},
  {name:"reserver",description:"Ouvrir le calendrier de réservation des cours"},
  {name:"support",description:"Savoir comment contacter l'équipe Bon Point"}
 ];
 const url=`https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;
 let count=0;
 for(const command of commands){
  const response=await fetch(url,{method:"POST",headers:{"Authorization":"Bot "+botToken,"Content-Type":"application/json"},body:JSON.stringify({...command,type:1})});
  if(!response.ok){
   console.error("Échec de l'enregistrement de /"+command.name+" (HTTP "+response.status+"). Vérifiez l'application, les autorisations et le token.");
   process.exitCode=1;
   break;
  }
  console.log("Commande /"+command.name+" enregistrée.");
  count++;
 }
 if(count===commands.length)console.log("Les 4 commandes Bon Point sont prêtes dans votre serveur.");
}
