function result(){
    const date = new Date();
    let meridian = "";

    if(date.getHours() >= 12){
        meridian = "PM";
    }else{
        meridian = "AM";    
    }

    let hours = date.getHours();
    hours = hours % 12 || 12;
    hours = hours.toString().padStart(2,0);
    const minutes = date.getMinutes().toString().padStart(2,0);
    const seconds = date.getSeconds().toString().padStart(2,0);

    let str = `${hours} : ${minutes} : ${seconds} : ${meridian}`;
    document.getElementById("res").textContent = str;
}

result();
setInterval(result,1000);
