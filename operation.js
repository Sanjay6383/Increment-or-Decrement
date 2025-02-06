let value = 0;
document.getElementById("res").textContent = value;

document.getElementById("inc").onclick = function(){
    value += 1;
    document.getElementById("res").textContent = value;
}

document.getElementById("dec").onclick = function(){
    value -= 1;
    document.getElementById("res").textContent = value;
}

document.getElementById("reset").onclick = function(){
    value = 0;
    document.getElementById("res").textContent = value;
}
