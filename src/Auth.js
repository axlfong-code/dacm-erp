/******************************************************
 * Authentication
 ******************************************************/

function login(username,password){

  const sh = getSheet(CONFIG.SHEET.USER);

  const data = sh.getDataRange().getValues();

  for(let i=1;i<data.length;i++){

      if(

          data[i][2]==username &&

          data[i][3]==password &&

          data[i][7]=="AKTIF"

      ){

          return{

              success:true,

              nama:data[i][1],

              role:data[i][4],

              cabang:data[i][5]

          };

      }

  }

  return{

      success:false,

      message:"Username atau Password salah"

  };

}