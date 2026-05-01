#!/bin/bash
# TrackXY: Optical Point Tracking and Analysis Tool
# Copyright (C) 2012, 2026 Liam D. Gray
#
# This program is free software: you can redistribute it and/or modify
# it under the terms of the GNU Affero General Public License as published
# by the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU Affero General Public License for more details.
#
# You should have received a copy of the GNU Affero General Public License
# along with this program.  If not, see <http://www.gnu.org/licenses/>.
# AfterAgent hook script for Wiggum loop signaling

# This script runs after every turn.
# It can be used to signal completion to an external driver.
# For now, we just ensure a consistent exit state.

echo "Turn complete. Signalling Wiggum driver."
exit 0
