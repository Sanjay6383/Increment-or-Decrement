let val = 0;
const a = document.getElementById("ctf");

document.getElementById("sub").onclick = function(){
    if(a.checked){
        val = document.getElementById("input").value;
        let res = val * (9 / 5) + 32;
        document.getElementById("result").textContent = res;
    }else{
        val = document.getElementById("input").value;
        let res = (val - 32 )* (5 / 9);
        document.getElementById("result").textContent = res;
    }
}