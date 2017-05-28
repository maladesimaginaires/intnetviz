'use strict';

// Play scaling factors...
const scaling_for = {
    "author=moliere&play=l_avare": 2,
    "author=moliere&play=l_ecole_des_femmes": 1.8,
    "author=moliere&play=le_medecin_malgre_lui": 1.7,
    "author=moliere&play=le_misanthrope": 1.8,
    "author=jean_racine&play=phedre": 2,
};

// variables de path...
const base_data_path = "data/"
const char_file_suffix = "_personnages.txt"
const text_file_suffix = "_texte.txt"
const base_url = [
    location.protocol, '//',
    location.host,
    location.pathname
].join('');

// Selection de la piece
function selection_piece(s) {
    let query_string = s[s.selectedIndex].id
    window.location.href = base_url + "?" + query_string;
}

// Récupération des variables dans l'url...
function getQueryVariable(variable) {
    let query = window.location.search.substring(1);
    let vars = query.split("&");
    for(let i = 0; i < vars.length; i++) {
        let pair = vars[i].split("=");
        if (pair[0] == variable) { return pair[1] }
    }
    return(false);
}

// Piece par defaut (si non specifiee dans l'url)...
let author = getQueryVariable("author")
let play = getQueryVariable("play")
if (author == false || play == false) {
    play = "l_ecole_des_femmes"
    author = "moliere"
}

let query_string = "author=" + author + "&play=" + play
document.getElementById(query_string).selected=true

// Scaling factor
let scaling = scaling_for[query_string]
if (scaling === undefined) {
    scaling = 1.5
}

// Chemin des fichiers d'input...
let play_path = author + "/" + play
let path_characters = base_data_path + play_path + char_file_suffix
let path_text = base_data_path + play_path + text_file_suffix

// Variables de couleurs
const color_not_yet_activated = "#eeeeee";
const color_not_yet_live = "#eeeeee";
const color_previously_activated = "#666666";
const color_previously_live = "#666666";
const color_activated = "#ff6600";
const color_live = "#ff6600";
const color_active = "#ffffff";

// Largeur et hauteur de la fenêtre où apparaît le réseau
const w = 640;
const h = 480;

// La rapidité d'animation en ms
const step_duration = 150;

// Epaisseur du contour des noeuds...
const node_stroke_width = 2

// Tailles min et max des noeuds et aretes...
const min_node_radius = 7;
const max_node_radius = 50;
const min_edge_width  = 1;
const max_edge_width  = 15;

// Decalage des labels...
const label_x_offset = 5
const label_y_offset = 5

// Traitement de l'événement "wheel"...
document.getElementById("reseau").addEventListener("wheel", wheel_up_or_down);
document.getElementById("ligne_reference").addEventListener("wheel", wheel_up_or_down);
function wheel_up_or_down(e) {
    if (e.deltaY < 0 && current_line > 0) {
        current_line--;
        update_display();
    }
    else if (e.deltaY > 0 && current_line < number_of_lines-1) {
        current_line++;
        update_display();
    }
}

// current_line nous donne la replique actuelle.
let current_line = 0;

// Indique si l'animation est en cours.
let animation_is_on = 0

// La variable temp permet d'appeler le tableau de données en dehors de d3.tsv, par exemple dans la console
let temp = [];

// Idem pour dataset etc...
let dataset;
let svg;
let number_of_lines;
let position_slider;
let tableau_actes = [];
let tableau_scenes = [];

// Importation des donnees et precalcul des etats.
import_play_data();

function import_play_data() {
    // Importation des noeuds et gestion des fichiers à l'interieur de
    // la fonction d3.tsv pour pallier les problemes d'asychronisme de
    // JavaScript
    d3.tsv(path_characters, function(data_nodes) {
        // Importation du second fichier contenant les répliques
        d3.tsv(path_text, function(data_text) {

        // Création d'un tableau récoltant les positions des changements d'actes
         for(let i=1; i<data_text.length-1; i++){
             if(data_text[i].div1_nom != data_text[i+1].div1_nom){
                 // ajout du numéro de ligne du nouvel acte
                 tableau_actes.push(i+1);
             }
         }

        // Création d'un tableau récoltant les positions des changements de scènes
         for(let i=1; i<data_text.length-1; i++){
             if(data_text[i].div2_nom != data_text[i+1].div2_nom){
                 // ajout du numéro de ligne du nouvel acte
                 tableau_scenes.push(i+1);
             }
         }

        // Création d'une échelle pour graduer le slider par scène
        let echelle_slider_scenes = d3.scale.linear()
             .domain([0,data_text.length])
             .range([0,527]); // en attendant w

        // Ajout des graduations par scènes
        let grduations_scenes = d3.select('#graduations')
            .selectAll('line.graduations_scenes')
            .data(tableau_scenes)
            .enter()
            .append("line")
            .attr("class","graduations_scenes")
            .attr("x1", function(d){return echelle_slider_scenes(d)})
            .attr("y1", 10)
            .attr("x2", function(d){return echelle_slider_scenes(d)})
            .attr("y2", 25)
            .style("stroke", "gray")
            .style("stroke-width", 1);

        // Création d'une échelle pour graduer le slider par acte
        let echelle_slider_actes = d3.scale.linear()
             .domain([0,data_text.length])
             .range([0,527]); // en attendant w

        // Ajout des graduations par actes
        let grduations_actes = d3.select('#graduations')
            .selectAll('line.graduations_actes')
            .data(tableau_actes)
            .enter()
            .append("line")
            .attr("class","graduations_actes")
            .attr("x1", function(d){return echelle_slider_actes(d)})
            .attr("y1", 0)
            .attr("x2", function(d){return echelle_slider_actes(d)})
            .attr("y2", 35)
            .style("stroke", "black")
            .style("stroke-width", 1);

            // pour tester que les données soient bien chargées
            // console.log(data_nodes);
            // temp est déclarée en dehors de d3.tsv pour debug
            let temp = data_nodes;

            // colnames donne le nom de toutes les colonnes grâce à
            // la fonction Object.keys. Avec [0] on choisit la
            // première ligne, celle des en-têtes
            let colnames = Object.keys(data_nodes[0]);

            // ici les id des personnages, qui donnent aussi les
            // "keys" du tableau de données. Ce sont les noms
            // obtenus au stade précédent après exclusion des
            // 6 premières colonnes
            let node_ids = colnames.slice(6, colnames.length);

            // node5 est composé d'un objet par noeud
            // chaque noeud a un id (key) et un array qui donne
            // tous ses états
            let tmp_nodes = [];

            ///////////////////////////////////////////////////////
            // TODO: déterminer comment traiter les lignes qui ne
            // sont pas des répliques (didascalies seules) dans la
            // construction des listes nodes et edges (ll. 119-306)
            ///////////////////////////////////////////////////////

            // variables d'optimisation
            let number_of_nodes = node_ids.length;
            number_of_lines = data_nodes.length;

            // Nombre de répliques effectivement prononcées...
            let number_of_spoken_lines = 0
            for(let i = 0; i < data_text.length; i++) {
                if (data_text[i]['texte'] != '__none__') {
                    number_of_spoken_lines++
                }
            }


            // Precalcul du rayon et des etats des noeuds; 4 etats
            // sont possibles:
            // - not_yet_activated (NYA)
            // - previously_activated (PA)
            // - activated (AD)
            // - active (AE)

            // Pour chaque noeud...
            for(let i = 0; i < number_of_nodes; i++) {
                // Recuperer l'id du perso.
                let character = node_ids[i]
                // Initialisations...
                let tmp_node_states = [];
                let tmp_node_names = [];
                let last_known_name = null;
                let has_been_activated = 0;
                let tmp_node_radius = [];
                let radius = min_node_radius;
                let radius_increment = (
                                            max_node_radius
                                          - min_node_radius
                                       )
                                       / number_of_spoken_lines;

                // Pour chaque replique...
                for(let k = 0; k < number_of_lines; k++) {
                    // Si le perso est present...
                    if (data_nodes[k][character] == 1) {
                        // Liste des persos prononcant la replique.
                        let char_ids = data_text[k]['id'].split(
                            /\s*(,|et)\s*/
                        )
                        // Si celui-ci prononce la replique => AE
                        let char_idx = char_ids.indexOf(character)
                        if (char_idx > -1) {
                            tmp_node_states.push('active')
                            radius += radius_increment;
                            let char_names = data_text[k]['nom'].split(
                                /\s*(,|et)\s*/
                            )
                            last_known_name = char_names[char_idx]
                        }
                        // Dans le cas contraire => AD
                        else{
                            tmp_node_states.push('activated')
                        }
                        // Signaler qu'il a ete active.
                        has_been_activated = 1
                    }
                    // Si le perso est absent...
                    else{
                        // S'il a ete active => PA
                        if (has_been_activated == 1) {
                            tmp_node_states.push('previously_activated')
                        }
                        // Dans le cas contraire => NYA
                        else{
                            tmp_node_states.push('not_yet_activated')
                        }
                    }
                    tmp_node_radius.push(radius)
                    tmp_node_names.push(last_known_name)
                }

                // Remplir le debut de la liste des noms avec le
                // 1er nom connu pour ce personnage, ou son id si
                // son nom n'est jamais connu (parce qu'il ne dit
                // aucune replique)...
                for(let k = 0; k < number_of_lines; k++) {
                    if (tmp_node_names[k] != null) {
                        let first_known_name = tmp_node_names[k]
                        for(let l = 0; l < k; l++) {
                            tmp_node_names[l] = first_known_name
                        }
                        break;
                    }
                    else{
                        tmp_node_names[k] = character
                    }
                }

                // Stocker personnage, sequence d'etats et de poids...
                tmp_nodes.push({
                    id: character,
                    name: tmp_node_names,
                    x: Math.random()*w,
                    y: Math.random()*h,
                    fixed: false,
                    step: tmp_node_states,
                    radius: tmp_node_radius,
                });
            }

            // Precalcul des états et poids des arêtes; le poids est
            // defini comme la proportion des repliques ou les deux
            // personnages en question sont copresents; 4 etats sont
            // possibles:
            // - never_live (NL)
            // - not_yet_live (NYL)
            // - previously_live (PL)
            // - live (L)
            let tmp_edges = [];
            // Pour chaque paire de noeuds...

            for(let i = 0; i < number_of_nodes-1; i++) {
                for(let j = i+1; j < number_of_nodes; j++) {

                    let tmp_edge_width = [];
                    let width = min_edge_width;
                    let width_increment = (
                                              max_edge_width
                                            - min_edge_width
                                          )
                                          / number_of_lines;

                    var tmp_edge_states = [];
                    // Calculer le nombre total de copresences et
                    // construire le vecteur des copresences...
                    let num_copresences = 0;
                    let copresences = []

                    for(let k = 0; k < number_of_lines; k++) {

                        let copresence = data_nodes[k][node_ids[i]]
                                       * data_nodes[k][node_ids[j]]
                                       ;
                        num_copresences += copresence;
                        copresences.push(copresence)
                        width += copresence * width_increment
                        tmp_edge_width.push(width)
                    }
                    // Si ces noeuds ne sont jamais copresents...
                    if (num_copresences == 0) {
                        // Tous les etats sont NL.
                        tmp_edge_states = Array.apply(
                                            null,
                                            Array(number_of_lines)
                                          )
                                          .map(
                                            function() {
                                                return 'never_live'
                                            }
                                          );
                    }
                    // Si ces noeuds sont copresents au moins une fois...
                    else{
                        // Initialisations...
                        var has_been_live = 0;
                        var tmp_edge_states = [];
                        // Pour chaque replique...
                        for(let k = 0; k < number_of_lines; k++) {
                            // Si ces noeuds sont copresents => L
                            if (copresences[k] == 1) {
                                tmp_edge_states.push('live')
                                has_been_live = 1;
                            }
                            // Sinon s'ils ont deja ete copresents => PL
                            else if (has_been_live == 1) {
                                tmp_edge_states.push('previously_live')
                            }
                            // Sinon => NYL
                            else{
                                tmp_edge_states.push('not_yet_live')
                            }
                        }
                    }

                    // Stocker le poids et la sequence d'etats...
                    if(num_copresences > 0){
                        tmp_edges.push({
                            source: i,
                            target: j,
                            value:  num_copresences/    number_of_lines,
                            step:   tmp_edge_states,
                            width:  tmp_edge_width,
                        })
                    }
                }
            }

            // Stockage du dataset (y.c. texte des repliques)
            dataset = {
                nodes: tmp_nodes,
                edges: tmp_edges,
                lines: data_text
            };

            // Initialisation du reseau...
            init_svg();

            // Initialisation du slider...
            position_slider = d3.slider()
                .min(0)
                .value(1)
                .max(number_of_lines-1)
                .on("slide", function(evt, value) {
                    current_line = Math.round(value);
                    update_display(current_line);
                });
            d3.select('#slider').call(position_slider);

            update_display(current_line);
        });
    });
}

// définition d'une fonction pour arrêter/démarrer l'animation
function play_pause() {
    d3.event.preventDefault();
    if (animation_is_on === 0) {
        if (current_line == number_of_lines-1) {
            current_line = 0
            update_display()
        }
        animation_is_on = 1;
        play_animation();
    }
    else{
        animation_is_on = 0;
    }
}

// Animation de la piece depuis la position actuelle...
function play_animation() {
    if (animation_is_on != 0){
        if (current_line < number_of_lines-1) {
            current_line++;
            update_display();
            setTimeout(
                play_animation,
                step_duration
            );
        }
    }
}

// Initialisation du reseau...
function init_svg() {

    // Creation du SVG (responsive)...
    svg = d3.select("div#conteneurReseau")
            .append("svg")
            .attr("id", "playgraph")
            // better to keep the viewBox dimensions with variables
            .attr("viewBox", "0 0 " + w + " " + h )
            .attr("preserveAspectRatio", "xMaxYMax");

    // réaction aux touches
    let corps = d3.select("body").on("keydown", function(e){
        if(d3.event.keyCode == "32"){
            play_pause();
        }
        // shift + alt + flèche, pour début/fin
        else if(d3.event.shiftKey && d3.event.altKey){
            if(d3.event.keyCode == "37"){
                current_line = 0;
            }
            else if(d3.event.keyCode == "39"){
                current_line = number_of_lines-1;
            }
            update_display();
        }
        // shift + flèche, pour reculer/avancer d'un acte
        else if(d3.event.shiftKey){
            if(d3.event.keyCode == "37"){
                current_line = acte_precedent();
            }
            else if(d3.event.keyCode == "39"){
                current_line = acte_suivant();
            }
            update_display();
        }
        // alt + flèche, pour reculer/avancer d'une scene
        else if(d3.event.altKey){
            if(d3.event.keyCode == "37"){
                d3.event.preventDefault();
                d3.event.stopPropagation();
                current_line = scene_precedente();
            }
            else if(d3.event.keyCode == "39"){
                d3.event.preventDefault();
                d3.event.stopPropagation();
                current_line = scene_suivante();
            }
            update_display();
        }
        // flèche à gauche, pour une réplique de moins
        else if(d3.event.keyCode == "37"){
            if (current_line > 0) {
                current_line--;
                update_display();
            }
        }
        // flèche à droite, pour une réplique de plus
        else if(d3.event.keyCode == "39"){
            if (current_line < number_of_lines-1) {
                current_line++;
                update_display();
            }
        }
    });

    // Clic sur réplique précédente = -1 réplique
    d3.select("div#previous_line_container").on("click", function(){
        if (current_line > 0) {
            current_line--;
            update_display();
        }
    });

    // Clic sur réplique suivante = +1 réplique
    d3.select("div#next_line_container").on("click", function(){
        if (current_line < number_of_lines-1) {
            current_line++;
            update_display();
        }
    });

    // ajout d'un bouton début
    d3.select("button#b_debut").on("click", function(){
        current_line = 0;
        update_display();
    });

    // ajout d'un bouton moins 1 acte
    d3.select("button#b_moins_1_acte").on("click", function(){
        current_line = acte_precedent();
        update_display();
    });

    // ajout d'un bouton moins 1 scene
    d3.select("button#b_moins_1_scene").on("click", function(){
        current_line = scene_precedente();
        update_display();
    });

    // ajout d'un bouton moins 1 replique
    d3.select("button#b_moins_1_replique").on("click", function(){
        if (current_line > 0) {
            current_line--;
            update_display();
        }
    });

    // ajout d'un bouton play/pause
    d3.select("button#b_play_pause").on("click", function(){
        play_pause();
    });

    // ajout d'un bouton plus 1 replique
    d3.select("button#b_plus_1_replique").on("click", function(){
        if (current_line < number_of_lines-1) {
            current_line++;
            update_display();
        }
    });

    // ajout d'un bouton plus 1 scene
    d3.select("button#b_plus_1_scene").on("click", function(){
        current_line = scene_suivante();
        update_display();
    });

    // ajout d'un bouton plus 1 acte
    d3.select("button#b_plus_1_acte").on("click", function(){
        current_line = acte_suivant();
        update_display();
    });

    // ajout d'un bouton fin
    d3.select("button#b_fin").on("click", function(){
        current_line = number_of_lines-1;
        update_display();
    });

   function acte_suivant(){
        // cas où on est déjà dans le dernier acte
        if(current_line >= tableau_actes[tableau_actes.length-1]){
            return(number_of_lines-1);
        }
          // cas où on est dans le premier acte
        else if(current_line < tableau_actes[0]){
            return(tableau_actes[0]);
        }
        // cas des actes intermédiaires
        else{
            for(let i = 0; i < tableau_actes.length-1; i++){
                // on détermine l'intervalle
                if(current_line >= tableau_actes[i] && current_line < tableau_actes[i+1]){
                    // on met à jour et on quitte la boucle
                    return(tableau_actes[i+1]);
                }
            }
        }
    };

    function acte_precedent(){
        // cas où on est dans le dernier acte
        if(current_line > tableau_actes[tableau_actes.length-1]){
            return(tableau_actes[tableau_actes.length-1]);
        }
          // cas où on est dans le premier acte
        else if(current_line <= tableau_actes[0]){
            return(0);
        }
        // cas des actes intermédiaires
        else{
            for(let i = tableau_actes.length-1; i > 0; i--){
                // on détermine l'intervalle
                if(current_line <= tableau_actes[i] && current_line > tableau_actes[i-1]){
                    // on met à jour et on quitte la boucle
                    return(tableau_actes[i-1]);
                }
            }
        }
    }

    function scene_suivante(){
        // cas où on est déjà dans la dernière scène
        if(current_line >= tableau_scenes[tableau_scenes.length-1]){
            return(number_of_lines-1)
        }
          // cas où on est dans la première scène
        else if(current_line < tableau_scenes[0]){
            return(tableau_scenes[0]);
        }
        // cas des scènes intermédiaires
        else{
            for(let i = 0; i < tableau_scenes.length-1; i++){
                // on détermine l'intervalle
                if(current_line >= tableau_scenes[i] && current_line < tableau_scenes[i+1]){
                    // on met à jour et on quitte la boucle
                    return(tableau_scenes[i+1]);
                }
            }
        }
    }

    function scene_precedente(){
        // cas où on est dans la dernière scène
        if(current_line > tableau_scenes[tableau_scenes.length-1]){
            return(tableau_scenes[tableau_scenes.length-1])
        }
          // cas où on est dans la première scène
        else if(current_line <= tableau_scenes[0]){
            return(0);
        }
        // cas des scènes intermédiaires
        else{
            for(let i = tableau_scenes.length-1; i > 0; i--){
                // on détermine l'intervalle
                if(current_line <= tableau_scenes[i] && current_line > tableau_scenes[i-1]){
                    // on met à jour et on quitte la boucle
                    return(tableau_scenes[i-1]);
                }
            }
        }
    };

    // Creation des aretes comme lignes...
    let edges = svg.selectAll("line")
        .data(dataset.edges)
        .enter()
        .append("line")

    //Initialisation du force layout...
    let d_fact = Math.sqrt(dataset.nodes.length)
    let force = d3.layout.force()
         .nodes(dataset.nodes)
         .links(dataset.edges)
         .size([0.9*w, 0.98*h])
         .linkDistance(data_nodes =>
            scaling * h / d_fact * (1-data_nodes.value))
         .linkStrength(1)
         .charge(-h/2)
         .gravity(.08)
         .start();

    // implémentation du Sticky force layout
    let drag = force.drag()
        .on("dragstart", dragstart);

    function dblclick(d) {
        d3.select(this).classed("fixed", d.fixed = false);
    }

    function dragstart(d) {
        d3.select(this).classed("fixed", d.fixed = true);
    }

    // Creation des noeuds comme cercles...
    let nodes = svg.selectAll("circle")
        .data(dataset.nodes)
        .enter()
        .append("circle")
        // événement pour fixer des noeuds
        .on("dblclick", dblclick)
        // activation du déplacement général
        .call(force.drag);

    // ajout des noms des personnages à chaque noeud
    let labels = svg.selectAll("text")
        .data(dataset.nodes)
        .enter()
        .append("text")
        .text(nodes => nodes.name[0]);

    // Ceci est appele a chaque etape du force layout...
    force.on("tick", function() {

        nodes.attr("cx", nodes => nodes.x)
             .attr("cy", nodes => nodes.y);

        edges.attr("x1", nodes => nodes.source.x)
             .attr("y1", nodes => nodes.source.y)
             .attr("x2", nodes => nodes.target.x)
             .attr("y2", nodes => nodes.target.y);

        labels.attr("x", function(nodes) {
                    return nodes.x + (
                        nodes.radius[current_line] / 2
                        + node_stroke_width
                        + label_x_offset
                    )
        })
              .attr("y", function(nodes) {
                    return nodes.y - (
                        nodes.radius[current_line] / 2
                        + node_stroke_width
                        + label_y_offset
                   )
        });
    });

}

// EXPERIMENTAL : vérifie si l'on est au début d'une scène
function debut_scene(element){
    if(element == current_line){
        document.getElementById("current_line_container").classList.add("debut_scene");
    }
    else{
        document.getElementById("current_line_container").classList.remove("debut_scene");
    }
}

// Mise a jour de l'affichage...
function update_display() {

    ///////////////////////////////////////////////////////////////
    // TODO: inclure plutôt la position de la réplique dans le
    // div2 (non dans la pièce), et afficher cette référence en
    // regard des répliques (sans le nom de la pièce).
    ///////////////////////////////////////////////////////////////

    position_slider.value(current_line);
    // "Adresse" de la replique...
    let line_reference = document.getElementById("line_reference");
    line_reference.innerHTML =
          //dataset.lines[current_line].piece + ", " +
          dataset.lines[current_line].div1_nom
        + ", " + dataset.lines[current_line].div2_nom
        + ", pos. " + dataset.lines[current_line].pos
        ;

    // Afficher le texte...
    document.getElementById("current_line_container")
            .innerHTML = format_line(dataset.lines, 0);
    if (number_of_lines > 1) {
        document.getElementById("next_line_container")
                .innerHTML = format_line(dataset.lines, 1);
    }
    if (current_line > 0) {
        document.getElementById("previous_line_container")
                .innerHTML = format_line(
                    dataset.lines,
                    current_line - 1
                );
    }
    else{
        document.getElementById("previous_line_container")
                .innerHTML = "";
    }
    document.getElementById("current_line_container")
            .innerHTML = format_line(
                dataset.lines,
                current_line
            );
    if (current_line < number_of_lines-1) {
        document.getElementById("next_line_container")
                .innerHTML = format_line(
                    dataset.lines,
                    current_line + 1
                );
    }
    else{
        document.getElementById("next_line_container")
                .innerHTML = "";
    }
    // mettre le scroll du conteneur "previous" au bas du texte
    let conteneurPrevious = document.getElementById("previous_line_container");
    conteneurPrevious.scrollTop = conteneurPrevious.scrollHeight;

    // Mise a jour des noeuds...
    svg.selectAll("circle")
        .transition()
        .duration(step_duration)
        .attr("r", nodes => nodes.radius[current_line])
        .style("fill", function(nodes) {
            switch (nodes.step[current_line]) {
                case 'not_yet_activated':       return color_not_yet_activated;
                case 'previously_activated':    return color_previously_activated;
                case 'activated':               return color_activated;
                case 'active':                  return color_active;
            }
        })
        .style("stroke", function(nodes) {
            switch (nodes.step[current_line]) {
                case 'not_yet_activated':       return color_not_yet_activated;
                case 'previously_activated':    return color_previously_activated;
                case 'activated':               return color_activated;
                case 'active':                  return color_live;
            }
        })
        .style("stroke-width", node_stroke_width);

    // Mise a jour des arêtes...
    svg.selectAll("line")
        .transition()
        .duration(step_duration)
        // tout ce qui suit est remplaçable par la ligne de code
        // suivante, mais on perd l'état initial:
        // .classed(function(edges){return edges.step[current_line];})
        .style("stroke", function(edges) {
            switch (edges.step[current_line]) {
                case 'not_yet_live':    return color_not_yet_live;
                case 'previously_live': return color_previously_live;
                case 'live':            return color_live;
            }
        })
        .style("stroke-width", function(edges) {
            if (edges.step[current_line] == 'never_live') {
                return 0;
            }
            else{
                return edges.width[current_line];
            }
        });

    // Mise à jour des labels...
    svg.selectAll("text")
        .transition()
        .duration(step_duration)
        .attr("x", function(nodes) {
            return nodes.x + (
                   nodes.radius[current_line] / 2
                 + node_stroke_width
                 + label_x_offset
            );
        })
        .attr("y", function(nodes) {
            return nodes.y - (
                   nodes.radius[current_line] / 2
                 + node_stroke_width
                 + label_y_offset
            );
        })
        .attr("text", function(nodes) {
            return nodes.name[current_line];
        });
};

// Formatage des répliques...
function format_line(data_text, line_num) {
    let output_text =  "<p>"
    if (data_text[line_num]['nom'] != "__none__") {
        output_text += `<b><constn class='nom_personnage'>${data_text[line_num]['nom']}</span></b>`;
    }
    if (data_text[line_num]['didascalie'] != "") {
        output_text += `<i>${data_text[line_num]['didascalie']}</i>`;
    }
    output_text += "</p><br>";
    if (data_text[line_num]['texte'] != "__none__") {
        output_text += data_text[line_num]['texte']
                      .replace(/<note[^>]*>.+?<\/note>/g, "")
                      .replace(/<l[^>]*>/g, "<p>")
                      .replace(/<\/l>/g, "</p>")
                      .replace(/<didascalie>/g, "<p><i>")
                      .replace(/<\/didascalie>/g, "</p></i>")
    }
    // Marquage du début des scènes et actes
    if (line_num == 0 || tableau_scenes.indexOf(line_num) !== -1 ){
        output_text = dataset.lines[line_num].div2_nom
                    + "</div><hr>"
                    + output_text;
    }
    if (line_num == 0 || tableau_actes.indexOf(line_num) !== -1 ){
        output_text = dataset.lines[line_num].div1_nom
                    + ", "
                    + output_text;
    }
    if (
        line_num == 0 ||
        tableau_scenes.indexOf(line_num) !== -1 ||
        tableau_actes.indexOf(line_num) !== -1
    ) {
        output_text = "<div align='center'>" + output_text
    }
    return output_text
}

let egg = new Egg("c,a,t,c,h", function() {
  let sample = new Audio("include/pika.mp3");
  sample.play();
  $('#egg').fadeIn(200, function() {
    window.setTimeout(function() { $('#egg').fadeOut(400) }, 2000);
  });
}).listen();
