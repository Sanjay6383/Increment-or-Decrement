const sub = document.getElementById("sub");
const no = document.getElementById("number");
const res1 = document.getElementById("res1");
const res2 = document.getElementById("res2");

sub.onclick = function(){
    let dice = no.value;
    let arr1 = [];
    let arr2 = [];
    for(let i = 0; i < dice; i++){
        let rand = Math.floor(Math.random() * 6) + 1
        arr1.push(rand);
        arr2.push(`<img src = "${rand}.png">`);
    }
    res1.textContent = `Dice : ${arr1.join(', ')}`;
    res2.innerHTML = arr2.join("");
}