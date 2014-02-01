define(['provoda', 'spv'], function(provoda, spv){
	"use strict";
	provoda.addPrototype("SongsListBase", {
		model_name: "playlist",
		tickListChanges: function(last_usable_song) {
			this.onChanges(last_usable_song);
		},
		init: function(opts){
			this._super(opts);
			
			var _this = this;
			this.app = opts.app;
			this.player = this.app.p;
			this.mp3_search = this.app.mp3_search;
			if (opts.pmd){
				this.pmd = opts.pmd;
			}
		
			this.on('child_change-' + this.main_list_name, function(e) {
				if (!e.skip_report){
					
					
					this.markTracksForFilesPrefinding();
					this.makePlayable();
					this.nextTick(this.tickListChanges, [e.last_usable_song]);
					
				}
			});
			this.watchChildrenStates(this.main_list_name, 'want_to_play', function(e) {
				if (e.value){
					this.idx_wplay_song = e.item;
				} else if (this.idx_wplay_song == e.item) {
					this.idx_wplay_song = null;
				}
			});
			this.watchChildrenStates(this.main_list_name, 'mp_show', function(e) {
				if (e.value){
					this.idx_show_song = e.item;
				} else if (this.idx_show_song == e.item) {
					this.idx_show_song = null;
				}
				
			});
			this.watchChildrenStates(this.main_list_name, 'player_song', function(e) {
				if (e.value){
					this.idx_player_song = e.item;
				} else if (this.idx_player_song == e.item) {
					this.idx_player_song = null;
				}
			});
			this.watchChildrenStates(this.main_list_name, 'can-use-as-neighbour', function(e) {
				_this.checkNeighboursStatesCh(e.item);
				
			});
			this.watchChildrenStates(this.main_list_name, 'is_important', function(e) {
				if (e.item.isImportant()){
					_this.checkNeighboursChanges(e.item);
				}
			});
			
		},
		getMainList: function() {
			return this[this.main_list_name];
		},
		main_list_name: 'songs-list',
		add: function(omo){
			var mo = spv.cloneObj({}, omo, false, ['track', 'artist', 'file']);
			return this.addDataItem(mo);
		},
		makeDataItem: function(obj) {
			return this.extendSong(obj);
		},
		isDataInjValid: function(obj) {
			if (!obj.track && !obj.artist){
				return;
			} else {
				return true;
			}
		},
		compareItemWithObj: function(song, omo, soft) {
			var artist_match = song.artist == omo.artist;
			if (artist_match){
				if (song.track == omo.track || (soft && (!song.track || !omo.track))){
					return true;
				}
			}
		},
		
		getLastSong: function(){
			var name = this.main_list_name;
			return this[name].length ? this[name][this[name].length - 1] : false;
		},
		getMainListChangeOpts: function() {
			return {
				last_usable_song: this.getLastUsableSong()
			};
		},
		
		onChanges: function(last_usable_song){
			if (last_usable_song && last_usable_song.isImportant()){
				//this.checkNeighboursChanges(last_usable_song);
			}
			var w_song = this.getWantedSong();
			var v_song = this.getViewingSong(w_song);
			var p_song = this.getPlayerSong(v_song);
			if (w_song && !w_song.hasNextSong()){
				this.checkNeighboursChanges(w_song, false, false, "playlist load");
			}
			if (v_song && !v_song.hasNextSong()) {
				this.checkNeighboursChanges(v_song, false, false, "playlist load");
			}
			
			if (p_song && v_song != p_song && !p_song.hasNextSong()){
				this.checkNeighboursChanges(p_song, false, false, "playlist load");
			}
		},
		die: function(){
			this.hideOnMap();
			this._super();
			for (var i = this[this.main_list_name].length - 1; i >= 0; i--){
				this[this.main_list_name][i].die();
			}

		},
		compare: function(puppet){
			var key_string_o = spv.stringifyParams(this.info);
			var key_string_p = spv.stringifyParams(puppet.info);
			
			return this.playlist_type == puppet.playlist_type && (key_string_o == key_string_p);
		},
		simplify: function(){
			var npl = this[this.main_list_name].slice();
			for (var i=0; i < npl.length; i++) {
				npl[i] = npl[i].simplify();
			}
			npl = spv.cloneObj({
				length: npl.length,
				playlist_title: this.playlist_title,
				playlist_type: this.playlist_type
			}, npl);
			
			
			return npl;
		},
		belongsToArtist: function(v){
			return !!(this.info && this.info.artist) && (!v || this.info.artist == v);
		},
		showTrack: function(artist_track){
			var will_ignore_artist;
			var artist_match_playlist = this.playlist_type == 'artist' && this.info.artist == artist_track.artist;
			if (!artist_track.artist || artist_match_playlist){
				will_ignore_artist = true;
			}
			
			
			
			for (var i=0; i < this[this.main_list_name].length; i++) {
				if (artist_track.track == this[this.main_list_name][i].track && (will_ignore_artist || artist_track.artist == this[this.main_list_name][i].artist)){
					var matched = this[this.main_list_name][i];
					matched.showOnMap();
					return true;
				}
			}
			/*
			if (artist_track.artist && artist_track.track){
				this.add(artist_track, true);
				
			}*/
			
			return this;
			
		},
		markAsPlayable: function() {
			this.updateState('can_play', true);
		},
		
		makePlayable: function(full_allowing) {
			for (var i = 0; i < this[this.main_list_name].length; i++) {
				var mo = this[this.main_list_name][i];
				var pi = mo.playable_info || {};
				mo.makeSongPlayalbe(pi.full_allowing || full_allowing, pi.packsearch, pi.last_in_collection);
				
			}
		},
		markTracksForFilesPrefinding: function(){
			var from_collection = + (new Date());
			for (var i=0; i < this[this.main_list_name].length; i++) {
				this[this.main_list_name][i]
					.setPlayableInfo({
						packsearch: from_collection,
						last_in_collection: i == this[this.main_list_name].length-1
					});
				
			}
			return this;
		},
		setWaitingNextSong: function(mo) {
			this.player.setWaitingNextSong(mo);
		},
		switchTo: function(mo, direction) {
	
			var playlist = [];
			for (var i=0; i < this[this.main_list_name].length; i++) {
				var ts = this[this.main_list_name][i].canPlay();
				if (ts){
					playlist.push(this[this.main_list_name][i]);
				}
			}
			var current_number  = playlist.indexOf(mo),
				total			= playlist.length || 0;
				
			if (playlist.length > 1) {
				var s = false;
				if (direction) {
					var next_preload_song = mo.next_preload_song;
					var can_repeat = !this.state('dont_rept_pl');
					if (next_preload_song){
						var real_cur_pos = this[this.main_list_name].indexOf(mo);
						var nps_pos = this[this.main_list_name].indexOf(next_preload_song);
						if (can_repeat || nps_pos > real_cur_pos){
							if (next_preload_song.canPlay()){
								s = next_preload_song;
							} else {
								this.setWaitingNextSong(mo);
								next_preload_song.makeSongPlayalbe(true);
							}
						}
						
					} else if (this.state('has_loader')){
						this.setWaitingNextSong(mo);

					} else {
						if (current_number == (total-1)) {
							if (can_repeat){
								s = playlist[0];
							}
							
						} else {
							s = playlist[current_number+1];
						}
					}

					
				} else {
					if ( current_number === 0 ) {
						s = playlist[total-1];
					} else {
						s = playlist[current_number-1];
					}
				}
				if (s){
					s.play();
				}
			} else if (playlist[0]){
				playlist[0].play();
			}
		
		},
		getWantedSong: function(exept) {
			
			//return spv.filter(this[this.main_list_name], 'states.want_to_play', function(v) {return !!v;})[0];
			return this.idx_wplay_song != exept && this.idx_wplay_song;
		},
		getViewingSong: function(exept) {
			//var song = spv.filter(this[this.main_list_name], 'states.mp_show', function(v) {return !!v;})[0];
			return this.idx_show_song != exept && this.idx_show_song;
		},
		getPlayerSong: function(exept) {
			//var song = spv.filter(this[this.main_list_name], "states.player_song", true)[0];
			return this.idx_player_song != exept && this.idx_player_song;
		},
		getLastUsableSong: function(){
			for (var i = this[this.main_list_name].length - 1; i >= 0; i--) {
				var cur = this[this.main_list_name][i];
				if (cur.canUseAsNeighbour()){
					return cur;
				}
				
			}
		},
		getNeighbours: function(mo, neitypes){
			var obj = {},i;
			if (neitypes){
				for (var song_type in neitypes){
					if (neitypes[song_type]){
						obj[song_type] = null;
					}
				}
			}
			var c_num = this[this.main_list_name].indexOf(mo);

			if (!neitypes || neitypes.prev_song){
				//ищем пред. композицию если нет ограничений 
				//или ограничения не касаются пред. композиции
				for (i = c_num - 1; i >= 0; i--) {
					if (this[this.main_list_name][i].canUseAsNeighbour()){
						obj.prev_song = this[this.main_list_name][i];
						break;
					}
				}
			}

			if (!neitypes || neitypes.next_song){
				//ищем след. композицию если нет ограничений 
				//или ограничения не касаются след. композиции
				for (i = c_num + 1; i < this[this.main_list_name].length; i++) {
					if (this[this.main_list_name][i].canUseAsNeighbour()){
						obj.next_song = obj.next_preload_song = this[this.main_list_name][i];
						break;
					}
				}
			}
			if ((!neitypes || neitypes.next_preload_song) && !obj.next_preload_song){
				//ищем композицю для предзагрузки если нет ограничений
				//или ограничения не касаются композиции для предзагрузки

				//и при этого такая композиция ещё не была найдена
				for (i = 0; i < c_num; i++) {
					if (this[this.main_list_name][i].canUseAsNeighbour()){
						obj.next_preload_song = this[this.main_list_name][i];
						break;
					}
				}
			}
			return obj;

		},
		findNeighbours: function(mo) {

			mo.next_song = false;
			mo.prev_song = false;
			mo.next_preload_song = false;

			var changes = this.getNeighbours(mo, {
				next_song: true,
				prev_song: true,
				next_preload_song: true
			});
			spv.cloneObj(mo, changes);
		},
		getNeighboursChanges: function(target_song, changed_song) {
			var
				i,
				check_list = {},
				o_ste = {
					next_song: target_song.next_song,
					prev_song: target_song.prev_song,
					next_preload_song: target_song.next_preload_song
				};


			var neighbours_changes;
			var changed_song_roles;

			
			if (changed_song){
				/*
				если знаем состояние какой именно композиции изменилось ("changed_song"),
				то проверяем какое значение оно имеет для целевой песни,
				если играет роль то проверяем их ухудшение иначе ищем все роли (улучшение состояние отвергнутых)
				*/
				for (i in o_ste){
					check_list[i] = o_ste[i] == changed_song;
					if (o_ste[i] == changed_song){
						changed_song_roles = changed_song_roles || true;
					}
				}
				if (changed_song_roles){
					if (changed_song.canUseAsNeighbour()){
						//throw new Error('this means that previously wrong song was selected!');
					}
					if (!changed_song.canUseAsNeighbour()){
						neighbours_changes = this.getNeighbours(target_song, check_list);
					}
				} else {
					/*
					если ("changed_song") не играет никакой роли, и её состояние ухудшилось, то можно ничего не делать
					*/
					if (changed_song.canUseAsNeighbour()){
						neighbours_changes = this.getNeighbours(target_song);
					}
					
				}
			} else {
				/*
				если не знаем состояние каких ухудшилось, то проверяем ухудшились ли текущие роли
				если нет, то ищем все (улучшение состояние отвергнутых)
				*/

				for (i in o_ste){
					if (o_ste[i] && !o_ste[i].canUseAsNeighbour()){
						check_list[i] = true;
						changed_song_roles = changed_song_roles || true;
					}
				}
				if (changed_song_roles){
					neighbours_changes = this.getNeighbours(target_song, check_list);
				} else {
					neighbours_changes = this.getNeighbours(target_song);
				}


			}


			var original_clone = spv.cloneObj({}, o_ste);
			if (neighbours_changes){
				spv.cloneObj(original_clone, neighbours_changes);
			}

			


			return spv.getDiffObj(o_ste, original_clone);
		},
		checkNeighboursChanges: function(target_song, changed_neighbour, viewing, log) {
			var changes = this.getNeighboursChanges(target_song, changed_neighbour);
			//console.log("changes");
			//console.log(); isImportant
			spv.cloneObj(target_song, changes);

			//this.findNeighbours();

			viewing = viewing || !!target_song.state("mp_show");
			var playing = !!target_song.state("player_song");
			var wanted = target_song.state('want_to_play');

			if (viewing){
				target_song.addMarksToNeighbours();
				if (target_song.prev_song && !target_song.prev_song.track){
					target_song.prev_song.getRandomTrackName();
				}
				
			}
			if ((viewing || playing) && target_song.next_preload_song){
				target_song.next_preload_song.makeSongPlayalbe(true);
			}
			if (!target_song.cncco){
				target_song.cncco = [];
			} else {
				target_song.cncco.push(log);
			}

			if (viewing || playing || wanted){
				if (!target_song.hasNextSong()){
					this.requestMoreData();
				}
			}

		},
		checkNeighboursStatesCh: function(target_song) {
			
			var v_song = this.getViewingSong(target_song);
			var p_song = this.getPlayerSong(target_song);
			var w_song = this.getWantedSong(target_song);
			if (v_song) {
				this.checkNeighboursChanges(v_song, target_song);
			}
			if (p_song && v_song != p_song){
				this.checkNeighboursChanges(p_song, target_song);
			}
			if (w_song && w_song != p_song && w_song != v_song){
				this.checkNeighboursChanges(w_song, target_song);
			}
			
		},
		checkNavRequestsPriority: function() {
			var i;
			
			var demonstration = [];

			var waiting_next = this.player.waiting_next;
			var v_song = this.getViewingSong();
			var p_song = this.getPlayerSong();


			var addToArray = function(arr, item) {
				if (arr.indexOf(item) == -1){
					arr.push(item);
					return true;
				}
			};


			if (v_song){
				addToArray(demonstration, v_song);
				if (v_song.next_song){
					addToArray(demonstration, v_song.next_song);
				} else if (this.state('has_loader')){
					addToArray(demonstration, this);
				}
				if (v_song.prev_song){
					addToArray(demonstration, v_song.prev_song);
				}
			}
			if (p_song){
				addToArray(demonstration, p_song);

				if (p_song.next_song){
					addToArray(demonstration, p_song.next_song);
				}
			}
			if (waiting_next){
				addToArray(demonstration, waiting_next);
				if (waiting_next.next_song){
					addToArray(demonstration, waiting_next.next_song);
				}
			}

			addToArray(demonstration, this);

			demonstration.reverse();
			for (i = 0; i < demonstration.length; i++) {
				demonstration[i].setPrio();
			}

		},
		checkRequestsPriority: function() {
			this.checkNavRequestsPriority();
		},
		subPager: function(pstr, string) {
			var parts = this.app.getCommaParts(string);
			var artist = parts[1] ? parts[0] : this.playlist_artist;

			return this.findMustBePresentDataItem({
				artist: artist,
				track: parts[1] ? parts[1] : parts[0]
			});
		}

	});
	
	
return {};
});