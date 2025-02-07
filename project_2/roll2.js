document.getElementById("roll").onclick = function(){
    let random_val = Math.floor(Math.random() * 7);
    let two = Math.floor(Math.random() * 7);
    document.getElementById("output").textContent = random_val;
    document.getElementById("output_1").textContent = two;
}
